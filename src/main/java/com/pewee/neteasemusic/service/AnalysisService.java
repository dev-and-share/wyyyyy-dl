package com.pewee.neteasemusic.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.google.common.collect.Lists;
import com.pewee.neteasemusic.enums.CommonRespInfo;
import com.pewee.neteasemusic.exceptions.ServiceException;
import com.pewee.neteasemusic.models.dtos.AlbumAnalysisRespDTO;
import com.pewee.neteasemusic.models.dtos.AlbumDTO;
import com.pewee.neteasemusic.models.dtos.AlbumInfoDTO;
import com.pewee.neteasemusic.models.dtos.ArtistDTO;
import com.pewee.neteasemusic.models.dtos.PlaylistAnalysisRespDTO;
import com.pewee.neteasemusic.models.dtos.PlaylistDTO;
import com.pewee.neteasemusic.models.dtos.PlaylistInfoDTO;
import com.pewee.neteasemusic.models.dtos.SingleMusicAnalysisRespDTO;
import com.pewee.neteasemusic.models.dtos.TrackDTO;
import com.pewee.neteasemusic.models.dtos.UserPlaylistListRespDTO;
import com.pewee.neteasemusic.models.dtos.UserPlaylistSummaryDTO;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import com.google.common.util.concurrent.ThreadFactoryBuilder;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class AnalysisService {
	
	@Autowired
    private NeteaseAPIService neteaseAPIService;

    // 克制拟真型异步线程池 (核心 4, 最大 8, 队列 256): 契合真实客户端并发行为, 杜绝风控风险
    private static final ExecutorService asyncExecutor = new ThreadPoolExecutor(
            4, 8, 60L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(256),
            new ThreadFactoryBuilder().setNameFormat("analysis-async-pool-%d").setDaemon(true).build(),
            new ThreadPoolExecutor.CallerRunsPolicy()
    );
	
	public void refreshCookie(String c) {
		neteaseAPIService.refreshCookie(c);
	}

	public SingleMusicAnalysisRespDTO analyzeSingleSong(Long id, String level) {
		checkReady();
        try {
            // 🚀 P1 优化：使用 CompletableFuture 并行拉取 urlV1、songDetail、getLyric (耗时由累加转为 Max)
            CompletableFuture<String> urlFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return neteaseAPIService.urlV1(id, level);
                } catch (Exception e) {
                    log.error("拉取歌曲播放 URL 异常, songId={}", id, e);
                    return null;
                }
            }, asyncExecutor);

            CompletableFuture<String> nameFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return neteaseAPIService.songDetail(Lists.newArrayList(id));
                } catch (Exception e) {
                    log.error("拉取歌曲详情异常, songId={}", id, e);
                    return null;
                }
            }, asyncExecutor);

            CompletableFuture<String> lyricFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    return neteaseAPIService.getLyric(id);
                } catch (Exception e) {
                    log.error("拉取歌词异常, songId={}", id, e);
                    return null;
                }
            }, asyncExecutor);

            CompletableFuture.allOf(urlFuture, nameFuture, lyricFuture).join();

            String urlJsonStr = urlFuture.get();
            String nameJsonStr = nameFuture.get();
            String lyricJsonStr = lyricFuture.get();

            JSONObject urlJson = StringUtils.isNotBlank(urlJsonStr) ? JSON.parseObject(urlJsonStr) : null;
            JSONObject nameJson = StringUtils.isNotBlank(nameJsonStr) ? JSON.parseObject(nameJsonStr) : null;
            JSONObject lyricJson = StringUtils.isNotBlank(lyricJsonStr) ? JSON.parseObject(lyricJsonStr) : null;

            JSONArray dataArray = urlJson != null ? urlJson.getJSONArray("data") : null;
            JSONObject songUrlData = (dataArray != null && !dataArray.isEmpty()) ? dataArray.getJSONObject(0) : null;
            
            JSONArray songsArray = nameJson != null ? nameJson.getJSONArray("songs") : null;
            if (songsArray == null || songsArray.isEmpty()) {
                return null;
            }
            JSONObject songInfo = songsArray.getJSONObject(0);

            SingleMusicAnalysisRespDTO dto = new SingleMusicAnalysisRespDTO();
            dto.setName(songInfo.getString("name"));
            dto.setRawData(songInfo); // Attach full NetEase raw song object

            // Extract Album (Check al -> album -> pc.alb)
            JSONObject alObj = songInfo.getJSONObject("al");
            if (alObj == null) {
                alObj = songInfo.getJSONObject("album");
            }
            if (alObj != null) {
                dto.setPic(alObj.getString("picUrl"));
                dto.setAl_name(alObj.getString("name"));
                dto.setAl_id(alObj.getLong("id"));
            }
            if ((dto.getAl_name() == null || dto.getAl_name().isEmpty()) && songInfo.containsKey("pc")) {
                JSONObject pcObj = songInfo.getJSONObject("pc");
                if (pcObj != null && StringUtils.isNotBlank(pcObj.getString("alb"))) {
                    dto.setAl_name(pcObj.getString("alb"));
                }
            }

            // Extract Artists (Check pc.ar first as it contains full chorus names, then ar/artists -> alias)
            String fullArtistName = null;
            if (songInfo.containsKey("pc")) {
                JSONObject pcObj = songInfo.getJSONObject("pc");
                if (pcObj != null && StringUtils.isNotBlank(pcObj.getString("ar"))) {
                    fullArtistName = pcObj.getString("ar");
                }
            }

            if (StringUtils.isNotBlank(fullArtistName)) {
                dto.setAr_name(fullArtistName);
            } else {
                JSONArray arArray = songInfo.getJSONArray("ar");
                if (arArray == null) {
                    arArray = songInfo.getJSONArray("artists");
                }
                if (arArray != null) {
                    String parsedAr = arArray.stream()
                            .map(ar -> {
                                JSONObject arObj = (JSONObject) ar;
                                String name = arObj.getString("name");
                                if (StringUtils.isBlank(name) && arObj.containsKey("alias")) {
                                    JSONArray alias = arObj.getJSONArray("alias");
                                    if (alias != null && !alias.isEmpty()) {
                                        name = alias.getString(0);
                                    }
                                }
                                return name;
                            })
                            .filter(StringUtils::isNotBlank)
                            .collect(Collectors.joining("/"));
                    dto.setAr_name(parsedAr);
                }
            }
            dto.setLyric(lyricJson != null && lyricJson.getJSONObject("lrc") != null ? lyricJson.getJSONObject("lrc").getString("lyric") : "");
            dto.setTlyric(lyricJson != null && lyricJson.containsKey("tlyric") && lyricJson.getJSONObject("tlyric") != null ? lyricJson.getJSONObject("tlyric").getString("lyric") : null);
            dto.setId(id);

            if (songUrlData != null && songUrlData.getString("url") != null) {
                dto.setUrl(songUrlData.getString("url").replace("http://", "https://"));
                dto.setSize(formatSize(songUrlData.getLongValue("size")));
                dto.setStatus(200);

                // 🎵 检查是否为试听片段 (Check if track is a free trial preview)
                if (songUrlData.containsKey("freeTrialInfo") && songUrlData.get("freeTrialInfo") != null) {
                    dto.setFreeTrial(true);
                    JSONObject fti = songUrlData.getJSONObject("freeTrialInfo");
                    if (fti != null && fti.containsKey("end") && fti.containsKey("start")) {
                        int duration = fti.getIntValue("end") - fti.getIntValue("start");
                        dto.setFreeTrialDuration(duration > 0 ? duration : null);
                    }
                } else if (songUrlData.containsKey("freeTimeTrialPrivilege") && songUrlData.getJSONObject("freeTimeTrialPrivilege") != null && songUrlData.getJSONObject("freeTimeTrialPrivilege").getIntValue("type") != 0) {
                    dto.setFreeTrial(true);
                } else {
                    dto.setFreeTrial(false);
                }
            } else {
                dto.setUrl(null);
                dto.setStatus(404);
                String reason = "因版权保护或所在地区限制暂时无法播放";
                if (songUrlData != null) {
                    int code = songUrlData.getIntValue("code");
                    int fee = songUrlData.getIntValue("fee");
                    JSONObject ftp = songUrlData.getJSONObject("freeTrialPrivilege");
                    if (ftp != null && ftp.getIntValue("cannotListenReason") == 1) {
                        reason = "因版权保护或所在地区限制暂时无法播放";
                    } else if (code == 404) {
                        reason = "因版权保护或所在地区限制暂时无法播放";
                    } else if (fee == 1 || fee == 4) {
                        reason = "VIP 或付费专享曲目，暂无播放权限";
                    } else if (StringUtils.isNotBlank(songUrlData.getString("message"))) {
                        reason = songUrlData.getString("message");
                    }
                }
                dto.setUnplayableReason(reason);
                dto.setFreeTrial(false);
            }

            return dto;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
	
	/**
     * 搜索 
     * @param keyword 关键词
     * @param limit 每页条数
     * @param offset 偏移量
     * @param type  搜索类型
     * 	单曲	1
		歌手	100
		专辑	10
		歌单	1000
     * @return
     * @throws Exception
     */
    public List<?> searchMusic(String keywords, Integer limit,int offset,Integer type) {
    	checkReady();
    	if (null == type) {
    		type = 1;
    	}
        try {
            String respStr = neteaseAPIService.searchMusic(keywords, limit,offset,type);
            JSONObject resp = JSON.parseObject(respStr);
            if (1 == type) {
            	//单曲	1
            	JSONArray songs = resp.getJSONObject("result").getJSONArray("songs");

                List<TrackDTO> trackList = new ArrayList<>();
                for (int i = 0; i < songs.size(); i++) {
                    JSONObject song = songs.getJSONObject(i);
                    TrackDTO dto = new TrackDTO();
                    dto.setId(song.getLong("id"));
                    dto.setName(song.getString("name"));
                    dto.setPicUrl(song.getJSONObject("al").getString("picUrl"));
                    dto.setAlbum(song.getJSONObject("al").getString("name"));
                    dto.setArtists(song.getJSONArray("ar").stream()
                        .map(ar -> ((JSONObject) ar).getString("name"))
                        .collect(Collectors.joining("/")));
                    trackList.add(dto);
                }
                return trackList;
            }
            
            if (100 == type) {
            	//歌手	100
            	JSONArray artists = resp.getJSONObject("result").getJSONArray("artists");
            	List<ArtistDTO> artistList = new ArrayList<>();
                for (int i = 0; i < artists.size(); i++) {
                    JSONObject artist = artists.getJSONObject(i);
                    ArtistDTO dto = new ArtistDTO();
                    dto.setId(artist.getLong("id"));
                    dto.setName(artist.getString("name"));
                    dto.setPicUrl(artist.getString("picUrl"));
                    artistList.add(dto);
                }
                return artistList;
            }
            
            if (10 == type) {
            	//专辑	10
            	JSONArray albums = resp.getJSONObject("result").getJSONArray("albums");
            	List<AlbumDTO> alubmList = new ArrayList<>();
            	for (int i = 0; i < albums.size(); i++) {
                    JSONObject alubm = albums.getJSONObject(i);
                    AlbumDTO dto =  JSON.parseObject(JSON.toJSONString(alubm),AlbumDTO.class);
                    alubmList.add(dto);
                }
                return alubmList;
            }
            
            if (1000 == type) {
            	//歌单 1000
            	JSONArray playlists = resp.getJSONObject("result").getJSONArray("playlists");
            	List<PlaylistDTO> playList = new ArrayList<>();
            	for (int i = 0; i < playlists.size(); i++) {
                    JSONObject p = playlists.getJSONObject(i);
                    PlaylistDTO dto =  JSON.parseObject(JSON.toJSONString(p),PlaylistDTO.class);
                    playList.add(dto);
                }
            	return playList;
            }
            return null;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    public PlaylistAnalysisRespDTO analyzePlaylist(Long playlistId) {
    	checkReady();
        PlaylistAnalysisRespDTO result = new PlaylistAnalysisRespDTO();
        try {
            String jsonStr = neteaseAPIService.getPlaylistDetail(playlistId);
            JSONObject json = JSON.parseObject(jsonStr);
            JSONObject playlist = json.getJSONObject("playlist");

            PlaylistInfoDTO playlistInfo = new PlaylistInfoDTO();
            playlistInfo.setId(playlist.getLong("id"));
            playlistInfo.setName(playlist.getString("name"));
            playlistInfo.setCoverImgUrl(playlist.getString("coverImgUrl"));
            playlistInfo.setDescription(playlist.getString("description"));
            if (playlist.getJSONObject("creator") != null) {
                playlistInfo.setCreator(playlist.getJSONObject("creator").getString("nickname"));
            } else {
                playlistInfo.setCreator(playlist.getString("creator"));
            }
            playlistInfo.setTrackCount(playlist.getIntValue("trackCount"));

            Long creatorUserId = playlist.getLong("userId");
            if (creatorUserId == null && playlist.getJSONObject("creator") != null) {
                creatorUserId = playlist.getJSONObject("creator").getLong("userId");
            }
            Boolean isSubscribed = playlist.getBoolean("subscribed");
            Long currentUid = neteaseAPIService.getUid();
            boolean isCreator = (currentUid != null && creatorUserId != null && currentUid.equals(creatorUserId));

            // 如果官方接口返回 false 但不是创建者，且当前用户已登录，则辅助校验用户歌单库
            if ((isSubscribed == null || !isSubscribed) && !isCreator && currentUid != null) {
                try {
                    isSubscribed = isUserSubscribedToPlaylist(currentUid, playlistId);
                } catch (Exception ignored) {
                }
            }

            playlistInfo.setUserId(creatorUserId);
            playlistInfo.setSubscribed(isSubscribed != null ? isSubscribed : false);
            playlistInfo.setIsCreator(isCreator);

            JSONArray tracks = playlist.getJSONArray("tracks");
            List<TrackDTO> trackList = new ArrayList<>();
            if (tracks != null) {
                for (int i = 0; i < tracks.size(); i++) {
                    JSONObject track = tracks.getJSONObject(i);
                    TrackDTO dto = new TrackDTO();
                    dto.setId(track.getLong("id"));
                    dto.setName(track.getString("name"));
                    if (track.getJSONObject("al") != null) {
                        dto.setPicUrl(track.getJSONObject("al").getString("picUrl"));
                        dto.setAlbum(track.getJSONObject("al").getString("name"));
                    }
                    if (track.getJSONArray("ar") != null) {
                        dto.setArtists(track.getJSONArray("ar").stream()
                            .map(ar -> ((JSONObject) ar).getString("name"))
                            .collect(Collectors.joining("/")));
                    }
                    trackList.add(dto);
                }
            }

            // 🚀 突破网易云 1000 首限制：若 trackIds 总数大于 tracks (1000)，自动批量请求 /song/detail 补齐剩余全部歌曲！
            JSONArray trackIds = playlist.getJSONArray("trackIds");
            if (trackIds != null && trackIds.size() > trackList.size()) {
                log.info("歌单总数超出 1000 首 (trackCount={}, trackIds={}), 正在批量补充后续歌曲详情...", playlistInfo.getTrackCount(), trackIds.size());
                List<Long> remainingIds = new ArrayList<>();
                for (int i = trackList.size(); i < trackIds.size(); i++) {
                    JSONObject item = trackIds.getJSONObject(i);
                    if (item != null && item.containsKey("id")) {
                        remainingIds.add(item.getLong("id"));
                    }
                }
                
                // 每次 500 首批量获取歌曲详情 (使用 CompletableFuture 并发并行拉取，大幅缩短大歌单等待耗时)
                List<List<Long>> chunks = Lists.partition(remainingIds, 500);
                List<CompletableFuture<List<TrackDTO>>> chunkFutures = chunks.stream()
                    .map(chunk -> CompletableFuture.supplyAsync(() -> {
                        List<TrackDTO> chunkTracks = new ArrayList<>();
                        try {
                            String detailJsonStr = neteaseAPIService.songDetail(chunk);
                            JSONObject detailJson = JSON.parseObject(detailJsonStr);
                            JSONArray songs = detailJson != null ? detailJson.getJSONArray("songs") : null;
                            if (songs != null) {
                                for (int i = 0; i < songs.size(); i++) {
                                    JSONObject song = songs.getJSONObject(i);
                                    TrackDTO dto = new TrackDTO();
                                    dto.setId(song.getLong("id"));
                                    dto.setName(song.getString("name"));
                                    if (song.getJSONObject("al") != null) {
                                        dto.setPicUrl(song.getJSONObject("al").getString("picUrl"));
                                        dto.setAlbum(song.getJSONObject("al").getString("name"));
                                    }
                                    if (song.getJSONArray("ar") != null) {
                                        dto.setArtists(song.getJSONArray("ar").stream()
                                            .map(ar -> ((JSONObject) ar).getString("name"))
                                            .collect(Collectors.joining("/")));
                                    }
                                    chunkTracks.add(dto);
                                }
                            }
                        } catch (Exception ex) {
                            log.error("批量补全歌单剩余歌曲详情失败, size={}", chunk.size(), ex);
                        }
                        return chunkTracks;
                    }, asyncExecutor))
                    .collect(Collectors.toList());

                CompletableFuture.allOf(chunkFutures.toArray(new CompletableFuture[0])).join();

                for (CompletableFuture<List<TrackDTO>> cf : chunkFutures) {
                    try {
                        trackList.addAll(cf.get());
                    } catch (Exception ignore) {
                    }
                }
                log.info("歌单详情全量解析完毕, 实际获得歌曲数: {}", trackList.size());
            }

            playlistInfo.setTracks(trackList);
            result.setPlaylist(playlistInfo);
            result.setStatus(200);
        } catch (Exception e) {
            log.error("解析歌单失败, id={}", playlistId, e);
            result.setStatus(500);
        }
        return result;
    }

    public AlbumAnalysisRespDTO analyzeAlbum(Long albumId) {
    	checkReady();
        AlbumAnalysisRespDTO result = new AlbumAnalysisRespDTO();
        try {
            String jsonStr = neteaseAPIService.getAlbumDetail(albumId);
            JSONObject json = JSON.parseObject(jsonStr);
            JSONObject album = json.getJSONObject("album");

            AlbumInfoDTO albumInfo = new AlbumInfoDTO();
            albumInfo.setId(album.getLong("id"));
            albumInfo.setName(album.getString("name"));
            albumInfo.setCoverImgUrl(album.getString("picUrl"));
            albumInfo.setPublishTime(album.getLong("publishTime"));
            albumInfo.setArtist(album.getJSONObject("artist").getString("name"));

            JSONArray songs = json.getJSONArray("songs");
            List<TrackDTO> trackList = new ArrayList<>();
            for (int i = 0; i < songs.size(); i++) {
                JSONObject track = songs.getJSONObject(i);
                TrackDTO dto = new TrackDTO();
                dto.setId(track.getLong("id"));
                dto.setName(track.getString("name"));
                dto.setPicUrl(track.getJSONObject("al").getString("picUrl"));
                dto.setAlbum(track.getJSONObject("al").getString("name"));
                dto.setArtists(track.getJSONArray("ar").stream()
                    .map(ar -> ((JSONObject) ar).getString("name"))
                    .collect(Collectors.joining("/")));
                trackList.add(dto);
            }
            albumInfo.setSongs(trackList);
            result.setAlbum(albumInfo);
            result.setStatus(200);
        } catch (Exception e) {
            result.setStatus(500);
        }
        return result;
    }
    
    public UserPlaylistListRespDTO getUserPlaylists( int limit, int offset) {
    	checkReady();
        UserPlaylistListRespDTO resp = new UserPlaylistListRespDTO();
        List<UserPlaylistSummaryDTO> allPlaylists = new ArrayList<>();
        boolean hasMore = true;
        int currentOffset = offset;
        Long userUid = neteaseAPIService.getUserUid();
        if (userUid == null) {
            try {
                userUid = neteaseAPIService.getAccountInfo();
            } catch (Exception ignored) {
            }
        }
        try {
            while (hasMore) {
                String jsonStr = neteaseAPIService.getUserPlaylist(userUid, limit, currentOffset);
                JSONObject root = JSON.parseObject(jsonStr);

                JSONArray playlistArray = root.getJSONArray("playlist");
                hasMore = root.getBooleanValue("more") && (playlistArray != null && !playlistArray.isEmpty());

                if (playlistArray != null) {
                    for (int i = 0; i < playlistArray.size(); i++) {
                        JSONObject pl = playlistArray.getJSONObject(i);
                        UserPlaylistSummaryDTO dto = new UserPlaylistSummaryDTO();
                        dto.setId(pl.getLong("id"));
                        dto.setName(pl.getString("name"));
                        dto.setCoverImgUrl(pl.getString("coverImgUrl"));

                        JSONObject creator = pl.getJSONObject("creator");
                        dto.setCreator(creator != null ? creator.getString("nickname") : null);

                        dto.setTrackCount(pl.getIntValue("trackCount"));
                        dto.setDescription(pl.getString("description"));
                        dto.setSubscribed(pl.getBoolean("subscribed"));
                        if (creator != null) {
                            dto.setUserId(creator.getLong("userId"));
                        } else {
                            dto.setUserId(pl.getLong("userId"));
                        }
                        allPlaylists.add(dto);
                    }
                }

                currentOffset += limit; // 下一页偏移
            }

            resp.setPlaylists(allPlaylists);
            resp.setTotal(allPlaylists.size());
            resp.setStatus(200);
        } catch (Exception e) {
            log.error("获取用户歌单列表失败, userUid={}", userUid, e);
            resp.setPlaylists(Collections.emptyList());
            resp.setTotal(0);
            resp.setStatus(500);
        }
        return resp;
    }

    private String formatSize(long value) {
        String[] units = {"B", "KB", "MB", "GB", "TB"};
        double size = value;
        for (String unit : units) {
            if (size < 1024) {
                return String.format("%.2f%s", size, unit);
            }
            size /= 1024.0;
        }
        return String.format("%.2fPB", size);
    }
    
    /**
     * 辅助校验指定歌单是否在当前登录用户的收藏列表中
     */
    private boolean isUserSubscribedToPlaylist(Long uid, Long playlistId) {
        if (uid == null || playlistId == null) return false;
        try {
            String jsonStr = neteaseAPIService.getUserPlaylist(uid, 500, 0);
            JSONObject root = JSON.parseObject(jsonStr);
            JSONArray playlistArray = root.getJSONArray("playlist");
            if (playlistArray != null) {
                for (int i = 0; i < playlistArray.size(); i++) {
                    JSONObject pl = playlistArray.getJSONObject(i);
                    if (playlistId.equals(pl.getLong("id"))) {
                        Boolean sub = pl.getBoolean("subscribed");
                        return Boolean.TRUE.equals(sub);
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private void checkReady() {
    	if (!neteaseAPIService.checkReady()) {
    		throw new ServiceException(CommonRespInfo.NO_COOKIE_ERROR);
    	}
    }
	
}
