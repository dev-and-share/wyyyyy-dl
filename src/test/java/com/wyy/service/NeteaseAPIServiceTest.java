package com.wyy.service;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.wyy.exceptions.ServiceException;

@DisplayName("🔄 NeteaseAPIService 集中式网关降级与协议映射单元测试")
public class NeteaseAPIServiceTest {

    private static class StubNeteaseAPIService extends NeteaseAPIService {
        final List<String> calledUrls = new ArrayList<>();
        final List<Map<String, String>> calledFormParams = new ArrayList<>();
        final Map<String, String> responseByUrlPrefix = new LinkedHashMap<>();
        final Map<String, Exception> exceptionByUrlPrefix = new LinkedHashMap<>();
        final List<String> capturedWeapiUrls = new ArrayList<>();
        final List<Map<String, Object>> capturedWeapiData = new ArrayList<>();

        void setCookie(String cookieValue) throws Exception {
            Field f = NeteaseAPIService.class.getDeclaredField("cookie");
            f.setAccessible(true);
            f.set(this, cookieValue);
        }

        @Override
        protected String postForm(String url, Map<String, String> headers, Map<String, String> formParams) throws Exception {
            calledUrls.add(url);
            calledFormParams.add(formParams);
            for (Map.Entry<String, Exception> entry : exceptionByUrlPrefix.entrySet()) {
                if (url.startsWith(entry.getKey())) {
                    throw entry.getValue();
                }
            }
            for (Map.Entry<String, String> entry : responseByUrlPrefix.entrySet()) {
                if (url.startsWith(entry.getKey())) {
                    return entry.getValue();
                }
            }
            return "{\"code\":200}";
        }

        @Override
        protected String executeWeapiRaw(String url, Map<String, Object> data) throws Exception {
            capturedWeapiUrls.add(url);
            capturedWeapiData.add(data == null ? null : new LinkedHashMap<>(data));
            return super.executeWeapiRaw(url, data);
        }
    }

    @Test
    @DisplayName("Linux Forward 正常返回 JSON 时不触发降级")
    public void testLinuxApiPrimarySuccess() throws Exception {
        StubNeteaseAPIService service = new StubNeteaseAPIService();
        service.resetLinuxApiCooldown();
        service.responseByUrlPrefix.put("https://music.163.com/api/linux/forward", "{\"code\":200,\"playlist\":[]}");

        String resp = service.getUserPlaylist(3554571L, 30, 0);

        Assertions.assertEquals("{\"code\":200,\"playlist\":[]}", resp);
        Assertions.assertEquals(1, service.calledUrls.size());
        Assertions.assertEquals("https://music.163.com/api/linux/forward", service.calledUrls.get(0));
    }

    @Test
    @DisplayName("Linux Forward 返回 502 HTML 时自动切换 WEAPI 并短时熔断")
    public void testLinuxApi502FallsBackToWeapiAndCooldown() throws Exception {
        StubNeteaseAPIService service = new StubNeteaseAPIService();
        service.resetLinuxApiCooldown();
        service.setCookie("MUSIC_U=abc; __csrf=testcsrf123");
        service.responseByUrlPrefix.put(
                "https://music.163.com/api/linux/forward",
                "<html><head><title>502 Bad Gateway</title></head><body>502</body></html>");
        service.responseByUrlPrefix.put(
                "https://music.163.com/weapi/v3/discovery/recommend/songs",
                "{\"code\":200,\"data\":{\"dailySongs\":[]}}");

        String firstResp = service.getDailyRecommendSongs();
        Assertions.assertEquals("{\"code\":200,\"data\":{\"dailySongs\":[]}}", firstResp);
        Assertions.assertEquals(2, service.calledUrls.size());
        Assertions.assertEquals("https://music.163.com/api/linux/forward", service.calledUrls.get(0));
        Assertions.assertTrue(service.calledUrls.get(1).startsWith("https://music.163.com/weapi/v3/discovery/recommend/songs?csrf_token=testcsrf123"));

        // Second call within cooldown skips Linux Forward directly
        String secondResp = service.getDailyRecommendSongs();
        Assertions.assertEquals("{\"code\":200,\"data\":{\"dailySongs\":[]}}", secondResp);
        Assertions.assertEquals(3, service.calledUrls.size());
        Assertions.assertTrue(service.calledUrls.get(2).startsWith("https://music.163.com/weapi/v3/discovery/recommend/songs"));
    }

    @Test
    @DisplayName("Linux Forward 502 且 WEAPI 被风控/405 时继续回退 EAPI")
    public void testCascadeLinuxToWeapiToEapi() throws Exception {
        StubNeteaseAPIService service = new StubNeteaseAPIService();
        service.resetLinuxApiCooldown();
        service.responseByUrlPrefix.put("https://music.163.com/api/linux/forward", "<html>502 Bad Gateway</html>");
        service.responseByUrlPrefix.put("https://music.163.com/weapi/song/red/count", "{\"code\":405,\"message\":\"rejected\"}");
        service.responseByUrlPrefix.put("https://interface3.music.163.com/eapi/song/red/count", "{\"code\":200,\"data\":{\"count\":99}}");

        String resp = service.getSongRedCount(186016L);

        Assertions.assertEquals("{\"code\":200,\"data\":{\"count\":99}}", resp);
        Assertions.assertEquals(3, service.calledUrls.size());
        Assertions.assertEquals("https://music.163.com/api/linux/forward", service.calledUrls.get(0));
        Assertions.assertTrue(service.calledUrls.get(1).startsWith("https://music.163.com/weapi/song/red/count"));
        Assertions.assertEquals("https://interface3.music.163.com/eapi/song/red/count", service.calledUrls.get(2));
    }

    @Test
    @DisplayName("全部通道均返回 HTML 502 时抛出清晰的 ServiceException")
    public void testAllChannels502ThrowsServiceException() throws Exception {
        StubNeteaseAPIService service = new StubNeteaseAPIService();
        service.resetLinuxApiCooldown();
        service.responseByUrlPrefix.put("https://", "<html>502 Bad Gateway</html>");

        ServiceException ex = Assertions.assertThrows(ServiceException.class, () -> service.getSongComments(186016L, 0, 20));
        Assertions.assertTrue(ex.getMessage().contains("/api/v1/resource/comments/R_SO_4_186016"));
    }

    @Test
    @DisplayName("deletePlaylist 降级 WEAPI 时自动把 pid 映射为 ids 数组字符串")
    public void testDeletePlaylistMapsPidToIdsForWeapi() throws Exception {
        StubNeteaseAPIService service = new StubNeteaseAPIService();
        service.resetLinuxApiCooldown();
        service.responseByUrlPrefix.put("https://music.163.com/api/linux/forward", "<html>502</html>");
        service.responseByUrlPrefix.put("https://music.163.com/weapi/playlist/delete", "{\"code\":200}");

        String resp = service.deletePlaylist(987654L);

        Assertions.assertEquals("{\"code\":200}", resp);
        Assertions.assertEquals(1, service.capturedWeapiData.size());
        Map<String, Object> weapiParams = service.capturedWeapiData.get(0);
        Assertions.assertEquals("[987654]", weapiParams.get("ids"));
        Assertions.assertFalse(weapiParams.containsKey("pid"));
    }

    @Test
    @DisplayName("WEAPI 返回空响应体时不伪造 200，继续自动回退至 EAPI")
    public void testWeapiEmptyBodyFallsBackToEapi() throws Exception {
        StubNeteaseAPIService service = new StubNeteaseAPIService();
        service.resetLinuxApiCooldown();
        service.responseByUrlPrefix.put("https://music.163.com/api/linux/forward", "<html>502 Bad Gateway</html>");
        service.responseByUrlPrefix.put("https://music.163.com/weapi/user/playlist", "");
        service.responseByUrlPrefix.put("https://interface3.music.163.com/eapi/user/playlist", "{\"code\":200,\"playlist\":[{\"id\":1,\"name\":\"MyList\"}],\"more\":false}");

        String resp = service.getUserPlaylist(3554571L, 30, 0);

        Assertions.assertTrue(resp.contains("MyList"));
        Assertions.assertEquals(3, service.calledUrls.size());
        Assertions.assertEquals("https://interface3.music.163.com/eapi/user/playlist", service.calledUrls.get(2));
    }
}
