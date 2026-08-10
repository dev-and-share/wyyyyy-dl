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
        }

        String defaultAlbum = file.getParentFile() != null ? file.getParentFile().getName() : "";

        try {
            AudioFile audioFile = AudioFileIO.read(file);
            Tag tag = audioFile.getTag();
            if (tag != null) {
                String t = tag.getFirst(FieldKey.TITLE);
                String a = tag.getFirst(FieldKey.ARTIST);
                String al = tag.getFirst(FieldKey.ALBUM);

                return new TagInfo(
                        (t != null && !t.trim().isEmpty()) ? t.trim() : defaultTitle,
                        (a != null && !a.trim().isEmpty()) ? a.trim() : defaultArtist,
                        (al != null && !al.trim().isEmpty()) ? al.trim() : defaultAlbum
                );
            }
        } catch (Exception ignored) {}

        return new TagInfo(defaultTitle, defaultArtist, defaultAlbum);
    }
}
