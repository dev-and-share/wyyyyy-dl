package com.wyy.utils;

import java.io.File;
import java.io.IOException;

import org.jaudiotagger.audio.AudioFile;
import org.jaudiotagger.audio.AudioFileIO;
import org.jaudiotagger.tag.FieldKey;
import org.jaudiotagger.tag.Tag;
import org.jaudiotagger.tag.images.Artwork;
import org.jaudiotagger.tag.images.ArtworkFactory;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class TagUtils {

    public static void setTags(File file, String title, String artist, String album) {
        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTag();
            if (tag == null) {
                tag = audioFile.createDefaultTag();
                audioFile.setTag(tag);
            }

            if (title != null) {
                tag.setField(FieldKey.TITLE, title);
            }
            if (artist != null) {
                tag.setField(FieldKey.ARTIST, artist);
            }
            if (album != null) {
                tag.setField(FieldKey.ALBUM, album);
            }

            audioFile.commit();
            log.info("Successfully set tags for file: {}", file.getName());
        } catch (Exception e) {
            log.error("Failed to set tags for file: " + file.getName(), e);
        }
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    @lombok.NoArgsConstructor
    @lombok.Builder
    public static class TagInfo {
        private String title;
        private String artist;
        private String album;
        private String quality;
        private Integer bitrate;
        private Integer sampleRate;
        private String format;
        private Boolean isLossless;
        private Integer duration;

        public TagInfo(String title, String artist, String album) {
            this.title = title;
            this.artist = artist;
            this.album = album;
            this.quality = "standard";
        }
    }

    public static TagInfo readTags(File file) {
        String defaultTitle = file.getName();
        int dotIdx = defaultTitle.lastIndexOf('.');
        if (dotIdx > 0) defaultTitle = defaultTitle.substring(0, dotIdx);
        
        String defaultArtist = "";
        if (defaultTitle.contains(" - ")) {
            String[] parts = defaultTitle.split(" - ", 2);
            defaultArtist = parts[0].trim();
            defaultTitle = cleanTrackTitle(parts[1]);
        } else if (defaultTitle.contains("-")) {
            String[] parts = defaultTitle.split("-", 2);
            defaultArtist = parts[0].trim();
            defaultTitle = cleanTrackTitle(parts[1]);
        } else {
            defaultTitle = cleanTrackTitle(defaultTitle);
        }

        File parent = file.getParentFile();
        String defaultAlbum = (parent != null) ? parent.getName() : "外部导入曲库";

        // 如果歌手为空，尝试从上级目录层级中探测（例如 /media/external/王菲/唱游/01.flac 或 /media/external/王菲/01.flac）
        if (defaultArtist.isEmpty() && parent != null) {
            File grandParent = parent.getParentFile();
            if (grandParent != null && !isGenericDir(grandParent.getName())) {
                defaultArtist = grandParent.getName();
            } else if (!isGenericDir(parent.getName())) {
                defaultArtist = parent.getName();
            }
        }

        String finalTitle = defaultTitle;
        String finalArtist = defaultArtist.isEmpty() ? "未知歌手" : defaultArtist;
        String finalAlbum = defaultAlbum;
        String quality = null;
        Integer bitrate = null;
        Integer sampleRate = null;
        String format = null;
        Boolean isLossless = null;
        Integer duration = null;

        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTag();
            if (tag != null) {
                String t = tag.getFirst(FieldKey.TITLE);
                String a = tag.getFirst(FieldKey.ARTIST);
                String al = tag.getFirst(FieldKey.ALBUM);

                if (t != null && !t.trim().isEmpty()) {
                    finalTitle = cleanTrackTitle(t);
                }
                if (a != null && !a.trim().isEmpty()) {
                    finalArtist = a.trim();
                }
                if (al != null && !al.trim().isEmpty()) {
                    finalAlbum = al.trim();
                }
            }

            org.jaudiotagger.audio.AudioHeader header = audioFile.getAudioHeader();
            if (header != null) {
                format = header.getFormat();
                bitrate = (int) header.getBitRateAsNumber();
                sampleRate = header.getSampleRateAsNumber();
                isLossless = header.isLossless();
                duration = header.getTrackLength();
                quality = calcQuality(header, file);
            }
        } catch (Exception e) {
            log.debug("读取音频文件标签异常: {}, 将使用智能文件名兜底", file.getName());
        }

        if (quality == null) {
            quality = calcQuality(null, file);
        }

        return TagInfo.builder()
                .title(finalTitle)
                .artist(finalArtist)
                .album(finalAlbum)
                .quality(quality)
                .bitrate(bitrate)
                .sampleRate(sampleRate)
                .format(format)
                .isLossless(isLossless)
                .duration(duration)
                .build();
    }

    /**
     * 🎶 真实物理音频参数计算音质分级：
     * - hires: 采样率 > 48000Hz 或位深 > 16bit 的高解析无损 (FLAC/WAV/DSF)
     * - lossless: CD 级真无损 (FLAC/WAV/APE/ALAC, isLossless = true)
     * - exhigh: 极高音质 MP3/AAC (比特率 ≥ 300kbps)
     * - higher: 高音质 MP3/AAC (比特率 190kbps ~ 299kbps)
     * - standard: 标准音质 (比特率 < 190kbps，如 128kbps)
     */
    public static String calcQuality(org.jaudiotagger.audio.AudioHeader header, File file) {
        String ext = "";
        if (file != null) {
            String name = file.getName();
            int dot = name.lastIndexOf('.');
            if (dot >= 0) ext = name.substring(dot + 1).toLowerCase();
        }

        boolean losslessExt = ext.equals("flac") || ext.equals("wav") || ext.equals("ape") || 
                              ext.equals("alac") || ext.equals("dsf") || ext.equals("dff");
        boolean isLossless = (header != null && header.isLossless()) || losslessExt;
        int sampleRate = header != null ? header.getSampleRateAsNumber() : 0;
        int bits = header != null ? header.getBitsPerSample() : 0;
        long bitrate = header != null ? header.getBitRateAsNumber() : 0;

        if (isLossless) {
            if (sampleRate > 48000 || bits > 16) {
                return "hires";
            }
            return "lossless";
        }

        // 有损编码格式 (MP3, AAC, M4A, OGG)
        if (bitrate >= 300) {
            return "exhigh";
        } else if (bitrate >= 190) {
            return "higher";
        } else if (bitrate > 0) {
            return "standard";
        }

        if (losslessExt) {
            return "lossless";
        }
        return "standard";
    }

    private static String cleanTrackTitle(String title) {
        if (title == null) return "";
        String s = title.trim();
        // 清除前导的点、句号、下划线及序号，例如 ".说好的幸福呢" -> "说好的幸福呢", "01. 说好的幸福呢" -> "说好的幸福呢"
        s = s.replaceAll("^[0-9]{1,3}[.\\-\\s_]+", "");
        s = s.replaceAll("^[.、。_\\-\\s]+", "");
        return s.trim();
    }

    private static boolean isGenericDir(String name) {
        if (name == null) return true;
        String lower = name.toLowerCase().trim();
        return lower.equals("media") || lower.equals("music") || lower.equals("external") || 
               lower.equals("downloads") || lower.equals("下载音乐") || lower.equals("external_music");
    }
}
