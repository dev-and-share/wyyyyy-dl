package com.pewee.neteasemusic.service;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;
import com.pewee.neteasemusic.models.common.DownloadTaskStatus;
import java.util.stream.Collectors;

import jakarta.annotation.Resource;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.alibaba.fastjson.JSON;
import com.pewee.neteasemusic.enums.CommonRespInfo;
import com.pewee.neteasemusic.exceptions.ServiceException;
import com.pewee.neteasemusic.models.dtos.AlbumAnalysisRespDTO;
import com.pewee.neteasemusic.models.dtos.PlaylistAnalysisRespDTO;
import com.pewee.neteasemusic.models.dtos.SingleMusicAnalysisRespDTO;
import com.pewee.neteasemusic.models.dtos.TrackDTO;
import com.pewee.neteasemusic.utils.FileUtils;
import com.pewee.neteasemusic.utils.HttpClientUtil;
import com.pewee.neteasemusic.utils.TagUtils;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileWriter;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class MusicDownloadService implements InitializingBean {

	public static final ThreadPoolExecutor executor = new ThreadPoolExecutor(5, 5, 60, TimeUnit.MINUTES,
			new ArrayBlockingQueue<>(10000));

	public static final ConcurrentHashMap<Long, DownloadTaskStatus> downloadTasks = new ConcurrentHashMap<>();

	@Value("${download.path}")
	private String path;

	private Boolean repeat = true;

	@Override
	public void afterPropertiesSet() throws Exception {
		String repeatFilePath = path + "repeat";
		File repeatFile = new File(repeatFilePath);
		if (!repeatFile.exists()) {
			this.repeat = true;
		} else {
			try (FileInputStream fileInputStream = new FileInputStream(repeatFile)) {
				byte[] arr = new byte[1];
				fileInputStream.read(arr);
				fileInputStream.close();
				String string = new String(arr);
				log.info("读取到repeat:{}", string);
				if ("1".equals(string)) {
					this.repeat = true;
				} else {
					this.repeat = false;
				}
			} catch (IOException e) {
				log.error("读取文件错误!", e);
			}
		}

		// 📦 拔除 ids.txt：启动时一次性将历史遗留的 ids.txt 迁移入 SQLite 数据库并彻底归档
		try {
			if (downloadHistoryDAO != null) {
				downloadHistoryDAO.migrateLegacyIdsFileIfPresent(this.path);
			}
		} catch (Exception e) {
			log.warn("检查并迁移历史 ids.txt 异常", e);
		}
	}

	@Resource
	private AnalysisService analysisService;

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}

	public static String getType(String url) {
		return getType(url, null);
	}

	public static String getType(String url, String fallbackType) {
		if (url != null && !url.trim().isEmpty()) {
			String cleanUrl = url.contains("?") ? url.substring(0, url.indexOf("?")) : url;
			int lastSlash = cleanUrl.lastIndexOf("/");
			String lastSegment = (lastSlash >= 0) ? cleanUrl.substring(lastSlash + 1) : cleanUrl;
			int dotIndex = lastSegment.lastIndexOf(".");
			if (dotIndex >= 0 && dotIndex < lastSegment.length() - 1) {
				String ext = lastSegment.substring(dotIndex).toLowerCase();
				if (ext.matches("^\\.(mp3|flac|m4a|aac|wav|ogg|ape|wma)$")) {
					return ext;
				}
			}
		}
		if (fallbackType != null && !fallbackType.trim().isEmpty()) {
			String cleanFallback = fallbackType.trim().toLowerCase();
			if (!cleanFallback.startsWith(".")) {
				cleanFallback = "." + cleanFallback;
			}
			if (cleanFallback.matches("^\\.(mp3|flac|m4a|aac|wav|ogg|ape|wma)$")) {
				return cleanFallback;
			}
		}
		return ".mp3";
	}

	@Resource
	private com.pewee.neteasemusic.dao.DownloadHistoryDAO downloadHistoryDAO;

	public void downloadSingleSongV2(Long id) {
		doDownloadSingleSongV2(id, this.path, "未知歌曲");
	}

	/**
	 * 🚀 边播边存后台静默落盘调度器（自动按歌单/专辑分类，试听曲目严格过滤）
	 */
	public void asyncDownloadOnPlay(Long id, String playlistName, String albumName, String trackName) {
		if (id == null || id <= 0) return;
		DownloadTaskStatus existing = downloadTasks.get(id);
		if (existing != null && ("DOWNLOADING".equals(existing.getStatus()) || "SUCCESS".equals(existing.getStatus()))) {
			return;
		}
		String targetDir = this.path + "__曲库__/";
		if (org.apache.commons.lang3.StringUtils.isNotBlank(playlistName)) {
			targetDir = this.path + "歌单/" + FileUtils.getValidatedPathName(playlistName) + "/";
		} else if (org.apache.commons.lang3.StringUtils.isNotBlank(albumName)) {
			targetDir = this.path + "专辑/" + FileUtils.getValidatedPathName(albumName) + "/";
		}
		final String finalDir = targetDir;
		final String finalName = (trackName != null && !trackName.trim().isEmpty()) ? trackName : "未知歌曲";
		executor.execute(() -> {
			try {
				doDownloadSingleSongV2(id, finalDir, finalName);
			} catch (Exception e) {
				log.warn("边播边存异步任务执行异常, id={}", id, e);
			}
		});
	}

	public void doDownloadSingleSongV2(Long id, String path, String trackName) {
		DownloadTaskStatus taskStatus = downloadTasks.get(id);
		if (taskStatus == null) {
			taskStatus = new DownloadTaskStatus(id, trackName, "PENDING", null, System.currentTimeMillis(), null);
			downloadTasks.put(id, taskStatus);
		}

		if (!repeat) {
			// 1. 优先查 SQLite 数据库中是否已记录该歌曲已下载
			if (downloadHistoryDAO.isSongDownloaded(id)) {
				log.info("歌曲id: {} 在 SQLite 已下载数据库中已存在, 跳过重复下载!", id);
				taskStatus.setStatus("SKIP");
				taskStatus.setErrorMsg("该歌曲已存在于本地磁盘中，跳过重复下载");
				return;
			}

			// 2. 检查本地物理磁盘中是否已存在匹配的音频文件
			DownloadHistoryDAO.DownloadHistoryItem localMatch = downloadHistoryDAO.findLocalFileBySongOrName(id, trackName, null);
			if (localMatch != null && Boolean.TRUE.equals(localMatch.getFileExists())) {
				log.info("歌曲id: {} ({}) 本地文件已存在: {}, 跳过重复下载!", id, trackName, localMatch.getFilePath());
				taskStatus.setStatus("SKIP");
				taskStatus.setErrorMsg("该歌曲已存在于本地磁盘中，跳过重复下载");
				taskStatus.setFilePath(localMatch.getFilePath());
				// 自愈：如果该条历史记录之前 song_id 为 0，立即纠偏补齐
				if (localMatch.getSongId() == null || localMatch.getSongId() <= 0) {
					downloadHistoryDAO.updateSongIdIfEmpty(localMatch.getId(), id);
				}
				return;
			}
		}

		taskStatus.setStatus("DOWNLOADING");
		try {
			SingleMusicAnalysisRespDTO analysisSingleMusic = analysisService.analyzeSingleSong(id, "lossless");
			if (analysisSingleMusic == null || 200 != analysisSingleMusic.getStatus()) {
				throw new RuntimeException("分析歌曲URL失败");
			}

			// 🛑 核心防污染拦截：如果标记为试听，直接拒绝落盘
			if (Boolean.TRUE.equals(analysisSingleMusic.getFreeTrial())) {
				log.info("歌曲 id: {} 为 VIP 试听片段，已阻止落盘入库", id);
				if (analysisSingleMusic.getName() != null) {
					taskStatus.setName(analysisSingleMusic.getName());
				}
				taskStatus.setStatus("SKIP");
				taskStatus.setErrorMsg("此曲为 VIP 试听片段(无法获取完整版音频)，已自动阻止落盘入库");
				return;
			}

			taskStatus.setName(analysisSingleMusic.getName());
			String artist = analysisSingleMusic.getAr_name();
			String songName = analysisSingleMusic.getName();

			// 🗂️ 目录决策：若未指定具体歌单/专辑目录，单一已知歌手归档至 {歌手名}/，多歌手/群星/未知归档至 __曲库__/
			String dir = path;
			if (dir.equals(this.path) || dir.equals(this.path + "__曲库__/") || dir.endsWith("/__曲库__/")) {
				if (isSingleKnownArtist(artist)) {
					dir = this.path + FileUtils.getValidatedPathName(artist.trim()) + "/";
				} else {
					dir = this.path + "__曲库__/";
				}
			}

			String fileName = (org.apache.commons.lang3.StringUtils.isNotBlank(artist))
					? FileUtils.getValidatedPathName(artist + " - " + songName)
					: FileUtils.getValidatedPathName(songName);
			log.info("开始将歌曲: {} 写入目录: {}", fileName, dir);
			File file = Paths.get(dir, fileName + getType(analysisSingleMusic.getUrl(), analysisSingleMusic.getType())).toFile();
			FileUtils.writeToFile(file.toPath(),
					HttpClientUtil.getInputStream(analysisSingleMusic.getUrl(), null));

			// 🛑 核心防污染拦截：如果下载的音频文件小于 1.2MB (1,250,000 字节)，判定为 30s VIP 试听片段，拒绝落盘入库并删除临时文件
			if (file.exists() && file.length() < 1250000) {
				log.warn("检测到歌曲: {} 属于 30s VIP 试听片段 (大小: {} KB)，自动擦除并拒绝入库!", fileName, file.length() / 1024);
				try { file.delete(); } catch (Exception ignored) {}
				throw new RuntimeException("该歌曲仅为 30s VIP 试听片段，已自动阻止落盘与入库");
			}

			TagUtils.setTags(file, analysisSingleMusic.getName(), analysisSingleMusic.getAr_name(),
					analysisSingleMusic.getAl_name());
			log.info("将歌曲: {} 写入目录: {} 已完成!", fileName, dir);
			try {
				log.info("开始将歌词: {} 写入目录: {}", fileName, dir);
				FileUtils.writeToFile(Paths.get(dir, fileName + ".lrc"),
						analysisSingleMusic.getLyric().getBytes("UTF-8"));
				log.info("将歌词: {} 写入目录: {} 已完成!", fileName, dir);
			} catch (UnsupportedEncodingException e) {
				e.printStackTrace();
			}
			taskStatus.setStatus("SUCCESS");
			taskStatus.setFilePath(file.getAbsolutePath());

			// 记录到 SQLite 历史库及扩展 Raw JSON 子表
			try {
				long historyId = downloadHistoryDAO.addRecord(
						id,
						analysisSingleMusic.getName(),
						analysisSingleMusic.getAr_name(),
						analysisSingleMusic.getAl_name(),
						file.getAbsolutePath(),
						file.length(),
						"lossless",
						"SUCCESS"
				);
				if (historyId > 0 && analysisSingleMusic != null) {
					String rawJson = com.alibaba.fastjson.JSON.toJSONString(analysisSingleMusic);
					downloadHistoryDAO.saveRawJson(historyId, rawJson);
				}
			} catch (Exception ex) {
				log.error("写入下载历史及 Raw JSON 失败", ex);
			}
		} catch (Exception e) {
			log.error("下载歌曲失败, id: {}", id, e);
			taskStatus.setStatus("FAILED");
			taskStatus.setErrorMsg(e.getMessage() != null ? e.getMessage() : e.toString());
		}
	}

	public void downloadPlaylistV2(Long id) {
		PlaylistAnalysisRespDTO analysisPlaylist = analysisService.analyzePlaylist(id);
		if (200 != analysisPlaylist.getStatus()) {
			throw new ServiceException(CommonRespInfo.SYS_ERROR);
		}
		List<TrackDTO> tracks = analysisPlaylist.getPlaylist().getTracks();
		for (TrackDTO trackDTO : tracks) {
			DownloadTaskStatus taskStatus = new DownloadTaskStatus(trackDTO.getId(), trackDTO.getName(), "PENDING", null, System.currentTimeMillis());
			downloadTasks.put(trackDTO.getId(), taskStatus);
			executor.execute(() -> {
				doDownloadSingleSongV2(trackDTO.getId(), this.path + "歌单/"
						+ FileUtils.getValidatedPathName(analysisPlaylist.getPlaylist().getName()) + "/", trackDTO.getName());
			});
		}
	}

	public void downloadAlbumV2(Long id) {
		AlbumAnalysisRespDTO analysisAlbum = analysisService.analyzeAlbum(id);
		if (200 != analysisAlbum.getStatus()) {
			throw new ServiceException(CommonRespInfo.SYS_ERROR);
		}
		List<TrackDTO> tracks = analysisAlbum.getAlbum().getSongs();
		for (TrackDTO trackDTO : tracks) {
			DownloadTaskStatus taskStatus = new DownloadTaskStatus(trackDTO.getId(), trackDTO.getName(), "PENDING", null, System.currentTimeMillis());
			downloadTasks.put(trackDTO.getId(), taskStatus);
			executor.execute(() -> {
				doDownloadSingleSongV2(trackDTO.getId(),
						this.path + "专辑/" + FileUtils.getValidatedPathName(analysisAlbum.getAlbum().getName()) + "/", trackDTO.getName());
			});
		}
	}

	public void setRepeat(Boolean repeat) {
		String repeatFile = path + "repeat";
		File file = new File(repeatFile);
		if (file.exists()) {
			file.delete();
		}
		try {
			file.createNewFile();
		} catch (IOException e) {
			log.error("创建文件错误!", e);
		}
		try (FileOutputStream fileOutputStream = new FileOutputStream(file)) {
			if (repeat) {
				fileOutputStream.write("1".getBytes());
			} else {
				fileOutputStream.write("0".getBytes());
			}
			fileOutputStream.flush();
			fileOutputStream.close();
		} catch (IOException e) {
			log.error("创建文件错误!", e);
		}
		;
		this.repeat = repeat;
	}

	public Boolean getRepeat() {
		return this.repeat;
	}

	public Collection<DownloadTaskStatus> getDownloadTasks() {
		return downloadTasks.values();
	}

	public DownloadTaskStatus getDownloadTask(Long id) {
		return id != null ? downloadTasks.get(id) : null;
	}

	public void clearDownloadTasks() {
		downloadTasks.clear();
	}

	public boolean isSingleKnownArtist(String artist) {
		if (artist == null || artist.trim().isEmpty()) {
			return false;
		}
		String clean = artist.trim();
		if ("群星".equals(clean) || "Various Artists".equalsIgnoreCase(clean) || "未知歌手".equals(clean) || "未知".equals(clean)) {
			return false;
		}
		// 检查是否包含多歌手常见分隔符：/、\、&、,、，、;、；、、以及 feat./ft.
		if (clean.contains("/") || clean.contains("\\") || clean.contains("&") 
				|| clean.contains(",") || clean.contains("，") || clean.contains(";") || clean.contains("；")
				|| clean.contains("、") || clean.toLowerCase().contains("feat.") || clean.toLowerCase().contains("ft.")) {
			return false;
		}
		return true;
	}

}
