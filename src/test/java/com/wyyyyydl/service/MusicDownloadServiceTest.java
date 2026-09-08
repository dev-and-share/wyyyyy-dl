package com.wyyyyydl.service;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("🎵 MusicDownloadService 文件后缀解析与安全测试")
public class MusicDownloadServiceTest {

    @Test
    @DisplayName("标准带扩展名 URL 解析")
    public void testStandardUrl() {
        String urlMp3 = "https://m801.music.126.net/20260906/ymusic/song.mp3?wsSecret=abcd";
        Assertions.assertEquals(".mp3", MusicDownloadService.getType(urlMp3));

        String urlFlac = "https://m801.music.126.net/20260906/ymusic/song.flac";
        Assertions.assertEquals(".flac", MusicDownloadService.getType(urlFlac));
    }

    @Test
    @DisplayName("用户故障复现场景：URL 末尾为纯数字 ID 无扩展名，绝不误截取域名 .net")
    public void testUrlWithoutExtension() {
        // 用户实际遇到的 URL 形态
        String problemUrl = "https://m701.music.126.net/20260906114218/295fe208c36e31b92d5eae7a328cfaed/ymusic/4_rXgUnyY_5TiCU0dNtN_Q==/509951162877094982?wsSecret=abcd";
        
        // 无 fallbackType 时，安全兜底为 .mp3
        String ext1 = MusicDownloadService.getType(problemUrl);
        Assertions.assertEquals(".mp3", ext1);
        Assertions.assertFalse(ext1.contains("/"), "后缀绝不能包含斜杠！");
        Assertions.assertFalse(ext1.contains(".net"), "绝不能误截取域名 .net！");

        // 有 API 返回的 type 时，优先使用 API type
        String ext2 = MusicDownloadService.getType(problemUrl, "flac");
        Assertions.assertEquals(".flac", ext2);

        String ext3 = MusicDownloadService.getType(problemUrl, "mp3");
        Assertions.assertEquals(".mp3", ext3);
    }

    @Test
    @DisplayName("边界值与异常安全兜底")
    public void testEdgeCases() {
        Assertions.assertEquals(".mp3", MusicDownloadService.getType(null));
        Assertions.assertEquals(".mp3", MusicDownloadService.getType(""));
        Assertions.assertEquals(".mp3", MusicDownloadService.getType("   "));
        
        // 非法扩展名拦截
        Assertions.assertEquals(".mp3", MusicDownloadService.getType("https://evil.com/payload.exe?a=1", "exe"));
    }
}
