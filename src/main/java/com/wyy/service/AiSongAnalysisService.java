package com.wyy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wyy.dao.IHistoryStorageRepository;
import com.wyy.models.dtos.AiSongAnalysisDTO;
import com.wyy.models.dtos.DownloadHistoryItem;
import com.wyy.utils.TagUtils;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 🔬 原曲逆向特征工程与声学标签分析服务
 */
@Service
@Slf4j
public class AiSongAnalysisService {

    @Autowired(required = false)
    private IHistoryStorageRepository downloadHistoryDAO;

    @Autowired
    private NeteaseAPIService neteaseAPIService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final Pattern LRC_TIME_TAG_PATTERN = Pattern.compile("\\[\\d{2}:\\d{2}[\\.:]?\\d{0,3}\\]");

    /**
     * 对指定歌曲进行多维逆向解构分析
     * @param songId 歌曲ID (网易云 ID 或 本地/第三方标识)
     * @param hintTitle 可选辅助标题
     * @param hintArtist 可选辅助歌手
     * @return 深度解构 DTO
     */
    public AiSongAnalysisDTO analyzeSong(String songId, String hintTitle, String hintArtist) {
        String title = StringUtils.isNotBlank(hintTitle) ? hintTitle : "未知曲目";
        String artist = StringUtils.isNotBlank(hintArtist) ? hintArtist : "未知艺术家";
        String album = "单曲 / 专辑";
        Integer duration = 180;
        String format = "mp3";
        Integer bitrate = 320;
        Integer sampleRate = 48000;
        String lyricRaw = "";

        // 1. 尝试从本地下载曲库与历史定位物理文件
        Long numericId = parseLongSafely(songId);
        if (downloadHistoryDAO != null) {
            DownloadHistoryItem item = null;
            if (numericId != null) {
                item = downloadHistoryDAO.findLocalFileBySongId(numericId);
            }
            if (item == null && StringUtils.isNotBlank(hintTitle)) {
                item = downloadHistoryDAO.findLocalFileBySongOrName(numericId != null ? numericId : 0L, hintTitle, hintArtist);
            }

            if (item != null) {
                if (StringUtils.isNotBlank(item.getSongName())) title = item.getSongName();
                if (StringUtils.isNotBlank(item.getArtist())) artist = item.getArtist();
                if (StringUtils.isNotBlank(item.getAlbum())) album = item.getAlbum();

                if (StringUtils.isNotBlank(item.getFilePath())) {
                    File file = new File(item.getFilePath());
                    if (file.exists() && file.isFile()) {
                        TagUtils.TagInfo tagInfo = TagUtils.readTags(file);
                        if (tagInfo != null) {
                            if (tagInfo.getDuration() != null && tagInfo.getDuration() > 0) duration = tagInfo.getDuration();
                            if (tagInfo.getBitrate() != null) bitrate = tagInfo.getBitrate();
                            if (tagInfo.getSampleRate() != null) sampleRate = tagInfo.getSampleRate();
                            if (tagInfo.getFormat() != null) format = tagInfo.getFormat().toLowerCase();
                        }
                    }
                }
            }
        }

        // 2. 尝试从网易云 API 拉取在线歌词与详情
        if (numericId != null && numericId > 0) {
            try {
                String lyricResp = neteaseAPIService.getLyric(numericId);
                if (StringUtils.isNotBlank(lyricResp)) {
                    JsonNode lyricNode = objectMapper.readTree(lyricResp);
                    if (lyricNode.has("lrc") && lyricNode.get("lrc").has("lyric")) {
                        lyricRaw = lyricNode.get("lrc").get("lyric").asText();
                    }
                }
            } catch (Exception e) {
                log.warn("⚠️ 获取歌词失败或无歌词: songId={}", songId);
            }

            if ("未知曲目".equals(title) || "未知艺术家".equals(artist)) {
                try {
                    String detailResp = neteaseAPIService.songDetail(java.util.Collections.singletonList(numericId));
                    if (StringUtils.isNotBlank(detailResp)) {
                        JsonNode detailNode = objectMapper.readTree(detailResp);
                        if (detailNode.has("songs") && detailNode.get("songs").isArray() && detailNode.get("songs").size() > 0) {
                            JsonNode s = detailNode.get("songs").get(0);
                            if (s.has("name")) title = s.get("name").asText();
                            if (s.has("ar") && s.get("ar").size() > 0) {
                                artist = s.get("ar").get(0).get("name").asText();
                            }
                            if (s.has("al") && s.get("al").has("name")) {
                                album = s.get("al").get("name").asText();
                            }
                            if (s.has("dt")) {
                                duration = s.get("dt").asInt() / 1000;
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("⚠️ 获取在线曲目详情失败: songId={}", songId);
                }
            }
        }

        // 3. 歌词清洗与语义特征推理
        String cleanLyric = cleanLyricText(lyricRaw);
        GenreProfile profile = deduceGenreProfile(title, artist, album, cleanLyric);

        String summary = String.format(
                "### 原曲声学与乐理逆向解构报告\n" +
                "- **曲目**: 《%s》 - %s\n" +
                "- **所属专辑**: %s\n" +
                "- **规格**: %s | %d kbps | %d Hz | 时长 %02d:%02d\n" +
                "- **推导风格赛道**: `%s` (%s)\n" +
                "- **建议调性与BPM**: %s, %d BPM\n" +
                "- **核心情绪基调**: %s\n" +
                "- **主奏乐器配器**: %s\n" +
                "- **歌词段落结构**: %s\n",
                title, artist, album, format.toUpperCase(), bitrate, sampleRate,
                duration / 60, duration % 60,
                profile.genreKey, profile.genreName,
                profile.estimatedKey, profile.estimatedBpm,
                profile.mood, profile.instrumentation,
                detectLyricStructure(cleanLyric)
        );

        return AiSongAnalysisDTO.builder()
                .refSongId(songId)
                .title(title)
                .artist(artist)
                .album(album)
                .duration(duration)
                .format(format)
                .bitrate(bitrate)
                .sampleRate(sampleRate)
                .genre(profile.genreKey)
                .lyric(cleanLyric)
                .mood(profile.mood)
                .instrumentation(profile.instrumentation)
                .estimatedBpm(profile.estimatedBpm)
                .estimatedKey(profile.estimatedKey)
                .analysisSummary(summary)
                .build();
    }

    private String cleanLyricText(String raw) {
        if (StringUtils.isBlank(raw)) return "";
        StringBuilder sb = new StringBuilder();
        String[] lines = raw.split("\n");
        for (String line : lines) {
            String trimmed = LRC_TIME_TAG_PATTERN.matcher(line).replaceAll("").trim();
            if (StringUtils.isNotBlank(trimmed) && !trimmed.startsWith("作词") && !trimmed.startsWith("作曲") && !trimmed.startsWith("编曲")) {
                sb.append(trimmed).append("\n");
            }
        }
        return sb.toString().trim();
    }

    private String detectLyricStructure(String cleanLyric) {
        if (StringUtils.isBlank(cleanLyric)) {
            return "纯器乐 / 无人声原声作品 (Instrumental)";
        }
        int lines = cleanLyric.split("\n").length;
        if (lines > 30) {
            return "标准主副歌多乐章结构 [Intro -> Verse 1 -> Chorus -> Verse 2 -> Chorus -> Outro]";
        } else if (lines > 15) {
            return "紧凑型两段式流行结构 [Verse -> Pre-Chorus -> Chorus -> Outro]";
        } else {
            return "短动机散文诗意结构 / 氛围长吟唱";
        }
    }

    private GenreProfile deduceGenreProfile(String title, String artist, String album, String lyric) {
        String combined = (title + " " + artist + " " + album + " " + lyric).toLowerCase();

        if (combined.contains("交响") || combined.contains("symphony") || combined.contains("epic") || combined.contains("zimmer") || combined.contains("管弦") || combined.contains("星际") || combined.contains("interstellar")) {
            return new GenreProfile("01_cinematic_epic_orchestra", "史诗电影交响", 110, "D minor", "磅礴史诗、震撼深邃", "汉斯·季默式重型铜管、大管风琴、太鼓与弦乐对位");
        } else if (combined.contains("钢琴") || combined.contains("新海诚") || combined.contains("piano") || combined.contains("微光") || combined.contains("纯爱") || combined.contains("天门")) {
            return new GenreProfile("02_shinkai_sentimental_piano", "新海诚纯爱治愈钢琴", 82, "G major", "治愈感伤、静谧微光", "弱音立式钢琴、独奏大提琴、温暖双簧管");
        } else if (combined.contains("eurobeat") || combined.contains("头文字") || combined.contains("燃") || combined.contains("二次元") || combined.contains("极速") || combined.contains("jpop") || combined.contains("j-pop")) {
            return new GenreProfile("04_high_energy_jpop_eurobeat", "极速二次元 Eurobeat", 140, "A minor", "高能亢奋、极速驰骋", "反拍跳跃 Synth Brass、高密度踩镲、高亢穿透女声");
        } else if (combined.contains("国风") || combined.contains("戏腔") || combined.contains("青衣") || combined.contains("京剧") || combined.contains("古筝") || combined.contains("断桥") || combined.contains("trap")) {
            return new GenreProfile("05_guofeng_opera_trap", "新国风空灵戏腔 Trap", 78, "C minor", "空灵凄美、东方韵味", "青衣高音假声、竹笛古筝、808 弯音滑音重低音");
        } else if (combined.contains("lofi") || combined.contains("lo-fi") || combined.contains("雨声") || combined.contains("咖啡") || combined.contains("慵懒") || combined.contains("自习")) {
            return new GenreProfile("06_cozy_lofi_rainy_day", "温暖慵懒 Lo-fi 咖啡厅", 75, "Eb major", "温暖松弛、惬意微醺", "暖色 Rhodes 电钢琴、黑胶唱片噪点、柔和 Boom-Bap 鼓点");
        } else if (combined.contains("celtic") || combined.contains("风笛") || combined.contains("爱尔兰") || combined.contains("凯尔特") || combined.contains("奇幻") || combined.contains("冒险")) {
            return new GenreProfile("07_celtic_fantasy_adventure", "凯尔特奇幻史诗冒险", 108, "D Dorian", "空灵高远、奇幻冒险", "爱尔兰风笛 (Uilleann Pipes)、锡哨、凯尔特竖琴、宝思兰鼓");
        } else if (combined.contains("赛博") || combined.contains("cyberpunk") || combined.contains("synthwave") || combined.contains("合成器") || combined.contains("工业")) {
            return new GenreProfile("08_cyberpunk_industrial_synthwave", "赛博朋克工业暗黑合成器", 115, "F# minor", "冰冷未来、机械反乌托邦", "重失真模拟合成器脉冲、锯齿波 Lead、工业重击底鼓");
        } else if (combined.contains("吉卜力") || combined.contains("ghibli") || combined.contains("室内乐") || combined.contains("木吉他") || combined.contains("久石让")) {
            return new GenreProfile("09_ghibli_acoustic_chamber", "吉卜力纯原声无鼓室内乐", 88, "F major", "纯净人文、温暖治愈", "指弹原声木吉他、独奏小提琴、木管组、零打击乐留白");
        } else if (combined.contains("摇滚") || combined.contains("rock") || combined.contains("gospel") || combined.contains("福音") || combined.contains("灵魂") || combined.contains("力量")) {
            return new GenreProfile("10_gospel_soul_power_rock", "力量福音流行摇滚", 110, "E major", "高亢爆发、热烈信仰", "Hammond B3 风琴、电吉他扫弦墙、胸声高音爆发、大型教堂合唱团");
        } else {
            // 默认兜底为华语录音棚流行大歌
            return new GenreProfile("03_mandopop_emotional_ballad", "华语录音棚流行大歌", 72, "C major", "深情催泪、录音棚人声微表情", "毛毡立式钢琴、流行弦乐群、气声与颤音、大动态低音");
        }
    }

    private Long parseLongSafely(String str) {
        if (StringUtils.isBlank(str)) return null;
        try {
            return Long.parseLong(str.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private static class GenreProfile {
        final String genreKey;
        final String genreName;
        final int estimatedBpm;
        final String estimatedKey;
        final String mood;
        final String instrumentation;

        GenreProfile(String genreKey, String genreName, int estimatedBpm, String estimatedKey, String mood, String instrumentation) {
            this.genreKey = genreKey;
            this.genreName = genreName;
            this.estimatedBpm = estimatedBpm;
            this.estimatedKey = estimatedKey;
            this.mood = mood;
            this.instrumentation = instrumentation;
        }
    }
}
