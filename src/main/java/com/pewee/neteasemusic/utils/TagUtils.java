package com.pewee.neteasemusic.utils;

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
    public static class TagInfo {
        private String title;
        private String artist;
        private String album;
    }

    public static TagInfo readTags(File file) {
        String defaultTitle = file.getName();
        int dotIdx = defaultTitle.lastIndexOf('.');
        if (dotIdx > 0) defaultTitle = defaultTitle.substring(0, dotIdx);
        
        String defaultArtist = "";
        if (defaultTitle.contains(" - ")) {
            String[] parts = defaultTitle.split(" - ", 2);
            defaultArtist = parts[0].trim();
            defaultTitle = parts[1].trim();
        } else if (defaultTitle.contains("-")) {
            String[] parts = defaultTitle.split("-", 2);
            defaultArtist = parts[0].trim();
            defaultTitle = parts[1].trim();
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

        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTag();
            if (tag != null) {
                String t = tag.getFirst(FieldKey.TITLE);
                String a = tag.getFirst(FieldKey.ARTIST);
                String al = tag.getFirst(FieldKey.ALBUM);

                return new TagInfo(
                        (t != null && !t.trim().isEmpty()) ? t.trim() : defaultTitle,
                        (a != null && !a.trim().isEmpty()) ? a.trim() : (defaultArtist.isEmpty() ? "未知歌手" : defaultArtist),
                        (al != null && !al.trim().isEmpty()) ? al.trim() : defaultAlbum
                );
            }
        } catch (Exception ignored) {}

        return new TagInfo(defaultTitle, defaultArtist.isEmpty() ? "未知歌手" : defaultArtist, defaultAlbum);
    }

    private static boolean isGenericDir(String name) {
        if (name == null) return true;
        String lower = name.toLowerCase().trim();
        return lower.equals("media") || lower.equals("music") || lower.equals("external") || 
               lower.equals("downloads") || lower.equals("下载音乐") || lower.equals("external_music");
    }
}
