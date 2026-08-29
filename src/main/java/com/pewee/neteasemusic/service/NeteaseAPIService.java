package com.pewee.neteasemusic.service;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.http.Header;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pewee.neteasemusic.enums.CommonRespInfo;
import com.pewee.neteasemusic.exceptions.ServiceException;
import com.pewee.neteasemusic.utils.HttpClientUtil;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class NeteaseAPIService implements InitializingBean{
	
	private volatile boolean ready = false;
	
	 private static final String AES_KEY = "e82ckenh8dichen8";
	 
	 @Value("${download.path}")
	 private String path;
	 
	 private final String cookieFile = "cookie.txt";
	 
	 private transient String cookie;
	 
	 private transient Long uid; // 登录用户 UID
	 
	 public Long getUserUid() {
		 return this.uid;
	 }
	 public void refreshCookie(String cookie) {
		 String cookiePath =  path + cookieFile;
		 File file = new File(cookiePath); 
		 if (file.exists()) {
			 file.delete();
		 }
		 File pFile = new File(file.getParent());
		 if(!pFile.exists()) {
			 pFile.mkdirs();
		 }
		 FileOutputStream outputStream = null;
		 try {
			outputStream = new FileOutputStream(file);
			IOUtils.write(cookie.getBytes("utf-8"), outputStream);
		} catch (Exception e) {
			throw new ServiceException(CommonRespInfo.SYS_ERROR,e);
		} finally {
			if (null != outputStream) {
				IOUtils.closeQuietly(outputStream);
			}
		}
		 this.cookie = cookie;
		 try {
				getAccountInfo();
				ready = true;
			} catch (Exception e) {
				ready = false;
				this.cookie = null;
				this.uid = null;
				file.delete();
				log.info("获取账号信息失败!,请重新登录!!");
				log.error("获取账号信息失败,需要重新登录",e);
				throw new ServiceException(CommonRespInfo.SYS_ERROR,e);
			}
	 }
	  
	 
	@Override
	public void afterPropertiesSet() throws Exception {
		String cookiePath =  path + cookieFile;
		File file = new File(cookiePath);
		
		if (file.exists() && file.length() > 0) {
			byte[] buff = new byte[(int)file.length()];
			try (FileInputStream fileInputStream = new FileInputStream(file)) {
				IOUtils.readFully(fileInputStream, buff);
			} ;
			this.cookie = new String(buff,"utf-8");
			try {
				getAccountInfo();
				ready = true;
			} catch (Exception e) {
				ready = false;
				this.cookie = null;
				this.uid = null;
				file.delete();
				log.info("获取账号信息失败!,请重新登录!!");
				log.error("获取账号信息失败,需要重新登录",e);
			}
		}
	}
	 
	 public boolean checkReady() {
		 return this.ready;
	 }
	 
	 
	 /**
	  * Formats and deduplicates the Cookie header value to prevent NetEase API blocking.
	  * 
	  * Note: The NetEase EAPI endpoint (specifically URL resolution v1) will return "url": null and 
	  * "code": -110 if it detects duplicate cookie keys where the first key contains an empty value, 
	  * e.g., "appver=" (which was previously hardcoded).
	  * This method checks if the cookie loaded from file already contains os, appver, or deviceId, 
	  * and appends defaults only if they are missing. It also sets appver=8.9.70 by default to mimic 
	  * the official NetEase PC client.
	  */
	 private static String getCookieValue(String cookie) {
		if (cookie == null) {
			return "os=pc;appver=8.9.70;osver=;deviceId=pyncm!";
		}
		StringBuilder cookieHeader = new StringBuilder();
		if (!cookie.contains("os=")) {
			cookieHeader.append("os=pc;");
		}
		if (!cookie.contains("appver=")) {
			cookieHeader.append("appver=8.9.70;");
		}
		if (!cookie.contains("deviceId=")) {
			cookieHeader.append("deviceId=pyncm!;");
		}
		cookieHeader.append(cookie);
		return cookieHeader.toString();
	 }

	private static String md5Hex(String input) throws Exception {
	        MessageDigest md = MessageDigest.getInstance("MD5");
	        byte[] digest = md.digest(input.getBytes("UTF-8"));
	        StringBuilder sb = new StringBuilder();
	        for (byte b : digest) {
	            sb.append(String.format("%02x", b & 0xff));
	        }
	        return sb.toString();
	    }

	    private static String aesEncryptECB(String input, String key) throws Exception {
	        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
	        SecretKeySpec keySpec = new SecretKeySpec(key.getBytes("UTF-8"), "AES");
	        cipher.init(Cipher.ENCRYPT_MODE, keySpec);
	        byte[] encrypted = cipher.doFinal(input.getBytes("UTF-8"));
	        StringBuilder sb = new StringBuilder();
	        for (byte b : encrypted) {
	            sb.append(String.format("%02x", b & 0xff));
	        }
	        return sb.toString();
	    }
	    
	    public Long getAccountInfo() throws Exception {
	        String url = "https://interface3.music.163.com/eapi/w/nuser/account/get";
	        String apiPath = "/api/w/nuser/account/get";

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("header", new ObjectMapper().writeValueAsString(config));

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);
	        
	        String accInfo = HttpClientUtil.postForm(url, headers, params);
	        ObjectMapper mapper = new ObjectMapper();
	        Map<String, Object> result = mapper.readValue(accInfo, Map.class);
	        Integer code = (Integer) result.get("code");
	        if (200 != code) {
	        	throw new ServiceException(CommonRespInfo.SERVICE_EXECUTION_ERROR);
	        }
	        Map<String, Object> accountMap = (Map<String, Object>)result.get("account");
	        Long id = Long.valueOf("" + accountMap.get("id")) ;
	        this.uid = id;
	        log.info("获取到当前登录用户id: {}",id);
	        return id;
	    }

	    public Long getUid() {
	        return this.uid;
	    }

	    
	    
	    /**
	     * 获取用户详情
	     * @param userId
	     * @return
	     * @throws Exception
	     */
	    public String getUserDetail(Long userId) throws Exception {
	        String apiPath = "/api/v1/user/detail";
	        String url = "https://interface3.music.163.com/eapi/v1/user/detail";

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("userId", userId);
	        payload.put("header", new ObjectMapper().writeValueAsString(config));

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);

	        return HttpClientUtil.postForm(url, headers, params);
	    }

	    
	    
	    /**
	     * 获取用户歌单
	     * @param userId
	     * @param limit
	     * @param offset
	     * @return
	     * @throws Exception
	     */
	    public String getUserPlaylist(Long userId, int limit, int offset) throws Exception {
	        if (userId == null) {
	            userId = getUid();
	        }
	        if (userId == null) {
	            userId = getAccountInfo();
	        }
	        Map<String, Object> innerParams = new LinkedHashMap<>();
	        innerParams.put("uid", userId);
	        innerParams.put("limit", limit);
	        innerParams.put("offset", offset);
	        innerParams.put("includeVideo", true);

	        return requestLinuxApi("http://music.163.com/api/user/playlist", innerParams);
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
			用户	1002
			MV	1004
			歌词	1006
	     * @return
	     * @throws Exception
	     */
	    public String searchMusic(String keyword, int limit, int offset, int type) throws Exception {
	        String apiPath = "/api/cloudsearch/pc";
	        String url = "https://interface3.music.163.com/eapi/cloudsearch/pc";

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("s", keyword);   // 搜索关键词
	        payload.put("limit", limit); // 每页条数
	        payload.put("offset", offset); // 偏移量
	        payload.put("type", type);   // 搜索类型：1=单曲 10=专辑 100=歌手 1000=歌单 ...
	        payload.put("header", new ObjectMapper().writeValueAsString(config));

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);

	        return HttpClientUtil.postForm(url, headers, params);
	    }

	    
	    
	    // 歌手详情与热门 50 首
	    public String getArtistDetail(Long artistId) throws Exception {
	        String apiPath = "/api/v1/artist/" + artistId;
	        String url = "https://interface3.music.163.com/eapi/v1/artist/" + artistId;

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("header", new ObjectMapper().writeValueAsString(config));
	        payload.put("top", 50);
	        payload.put("id", artistId);

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);

	        return HttpClientUtil.postForm(url, headers, params);
	    }

	    //专辑详情
	    public String getAlbumDetail(Long albumId) throws Exception {
	        String apiPath = "/api/v1/album/" + albumId;
	        String url = "https://interface3.music.163.com/eapi/v1/album/" + albumId;

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("header", new ObjectMapper().writeValueAsString(config));
	        payload.put("total", "true"); // 通常需要设置此字段
	        payload.put("id", albumId);   // 实际上该字段在路径中，但也加在 payload 中

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);

	        return HttpClientUtil.postForm(url, headers, params);
	    }

	    
	    //歌单详情
	    public String getPlaylistDetail(Long playlistId) throws Exception {
	        String url = "https://interface3.music.163.com/eapi/v6/playlist/detail";
	        String apiPath = "/api/v6/playlist/detail";

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("id", playlistId);
	        payload.put("n", 1000);  // 获取最多 1000 首歌
	        payload.put("s", 8);     // 歌单订阅者数等冗余信息
	        payload.put("header", new ObjectMapper().writeValueAsString(config));

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);

	        return HttpClientUtil.postForm(url, headers, params);
	    }

	    
	    //歌词
	    public String getLyric(Long songId) throws Exception {
	        String url = "https://interface3.music.163.com/eapi/song/lyric";
	        String apiPath = "/api/song/lyric";

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("id", songId);
	        payload.put("os", "pc");
	        payload.put("lv", -1);
	        payload.put("kv", -1);
	        payload.put("tv", -1);
	        payload.put("header", new ObjectMapper().writeValueAsString(config));

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);

	        return HttpClientUtil.postForm(url, headers, params);
	    }

	    
	    //获取详情
	    public String songDetail(List<Long> ids) throws Exception {
	        String url = "https://interface3.music.163.com/eapi/v3/song/detail";
	        String apiPath = "/api/v3/song/detail";

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("c", new ObjectMapper().writeValueAsString(
	                ids.stream().map(id -> {
	                    Map<String, Object> item = new HashMap<>();
	                    item.put("id", id);
	                    return item;
	                }).toArray()
	        ));
	        payload.put("ids", ids);
	        payload.put("header", new ObjectMapper().writeValueAsString(config));

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);

	        return HttpClientUtil.postForm(url, headers, params);
	    }

	    
	    
	    //获取下载url
	    public String urlV1(Long id, String level) throws Exception {
	        String url = "https://interface3.music.163.com/eapi/song/enhance/player/url/v1";
	        String apiPath = "/api/song/enhance/player/url/v1";

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("ids", Collections.singletonList(id));
	        payload.put("level", level);
	        payload.put("encodeType", "flac");
	        payload.put("header", new ObjectMapper().writeValueAsString(config));
	        if ("sky".equals(level)) {
	            payload.put("immerseType", "c51");
	        }

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	       Map<String, String> headers = new HashMap<String,String>();
	       Map<String, String> params = new HashMap<String,String>();
	       headers.put("Referer", "");
	       headers.put("Cookie",getCookieValue(cookie));
	       params.put("params", encParams);
	       return  HttpClientUtil.postForm(url, headers, params);
	    }
	    
	    
	    //===================================================================================================================
	    //以下为qr登录相关接口
	    
	    
	    public String getLoginQrKey() throws Exception {
	        String apiPath = "/api/login/qrcode/unikey";
	        String url = "https://interface3.music.163.com/eapi/login/qrcode/unikey";

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("type", 1);
	        payload.put("header", new ObjectMapper().writeValueAsString(config));

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);

	        return HttpClientUtil.postForm(url, headers, params);
	    }
	    
	    
	    /**
	     *  登录状态说明（checkLoginQrStatus返回值）：
				code = 800：二维码过期
				
				code = 801：等待扫码
				
				code = 802：已扫码，等待确认
				
				code = 803：登录成功，返回 cookie（需保存）
	     * @param unikey
	     * @return
	     * @throws Exception
	     */
	    public String checkLoginQrStatus(String unikey) throws Exception {
	        String apiPath = "/api/login/qrcode/client/login";
	        String url = "https://interface3.music.163.com/eapi/login/qrcode/client/login";

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("type", 1);
	        payload.put("key", unikey);
	        payload.put("header", new ObjectMapper().writeValueAsString(config));

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);

	        Pair<String,Header[]> responseAll =  HttpClientUtil.postFormAndReturnHeaders(url, headers, params);
	        String response = responseAll.getLeft();
	        
	        // 解析 JSON
	        JSONObject responseJSON = JSON.parseObject(response);
	        Integer code = (Integer) responseJSON.get("code");
	        log.info("查询qr登录返回码:{}",code);
	        if (code != null && code.intValue() == 803) {
	            // 登录成功，获取 cookie 写入文件
	        	Header[] headersresp = responseAll.getRight();
	        	for(int i = 0; i < headersresp.length ; i++) {
	        		Header header = headersresp[i];
	        		
	        		if (header.getName().equalsIgnoreCase("Set-Cookie")) {//
	        			String newCookie = (String) header.getValue();
	        			if (newCookie.startsWith("MUSIC_U")) {
	        				log.info("登录成功!开始写入cookie:{}",newCookie);
			                refreshCookie(newCookie);
			                break;
	        			}
	        		}
	        	}
	                
	        }
	        return response;
	    }
	    
	    /**
	     * 获取用户喜欢的全部红心歌曲 ID 列表
	     * @param userId 用户 ID (若为 null 则自动使用当前登录 uid)
	     * @return 包含所有红心歌曲 ID 的 JSON 响应
	     * @throws Exception
	     */
	    public String getLikedSongIds(Long userId) throws Exception {
	        Long targetUid = userId != null ? userId : this.uid;
	        if (targetUid == null) {
	            targetUid = getAccountInfo();
	        }
	        String apiPath = "/api/song/like/get";
	        String url = "https://interface3.music.163.com/eapi/song/like/get";

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "8.9.70");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("uid", targetUid);
	        payload.put("header", new ObjectMapper().writeValueAsString(config));

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);

	        return HttpClientUtil.postForm(url, headers, params);
	    }

	    /**
	     * 添加红心 / 取消红心单曲
	     * @param trackId 歌曲 ID
	     * @param like true 为添加红心，false 为取消红心
	     * @return EAPI 响应 JSON
	     * @throws Exception
	     */
	    public String likeTrack(Long trackId, boolean like) throws Exception {
	        if (trackId == null || trackId <= 0) {
	            throw new IllegalArgumentException("trackId 不能为空");
	        }
	        String apiPath = "/api/radio/like";
	        String url = "https://interface3.music.163.com/eapi/radio/like?alg=itembased&trackId=" + trackId + "&like=" + like + "&time=3";

	        Map<String, Object> config = new LinkedHashMap<>();
	        config.put("os", "pc");
	        config.put("appver", "8.9.70");
	        config.put("osver", "");
	        config.put("deviceId", "pyncm!");
	        config.put("requestId", String.valueOf(20000000 + new Random().nextInt(10000000)));

	        Map<String, Object> payload = new LinkedHashMap<>();
	        payload.put("trackId", trackId);
	        payload.put("like", like);
	        payload.put("time", 3);
	        payload.put("alg", "itembased");
	        payload.put("header", new ObjectMapper().writeValueAsString(config));

	        String jsonPayload = new ObjectMapper().writeValueAsString(payload);
	        String digest = md5Hex("nobody" + apiPath + "use" + jsonPayload + "md5forencrypt");
	        String rawParams = apiPath + "-36cd479b6b5-" + jsonPayload + "-36cd479b6b5-" + digest;
	        String encParams = aesEncryptECB(rawParams, AES_KEY);

	        Map<String, String> headers = new HashMap<>();
	        headers.put("Referer", "");
	        headers.put("Cookie", getCookieValue(this.cookie));

	        Map<String, String> params = new HashMap<>();
	        params.put("params", encParams);

	        return HttpClientUtil.postForm(url, headers, params);
	    }

	    /**
	     * 网易云官方 Web 端 WEAPI 协议公开常量体系 (源自官方 core.js，10+ 年未变)
	     * 1. WEAPI_NONCE: 第一道 AES-128-CBC 预设对称密钥
	     * 2. WEAPI_IV: AES-128-CBC 分组密码固定初始向量 (IV)
	     * 3. WEAPI_RSA_PUBLIC_KEY: 网易云服务端公开的 1024 位 RSA 公钥模数 (Modulus)，用于非对称加密客户端随机生成的 16 位 AES 密钥
	     * 4. WEAPI_RSA_EXPONENT: RSA 标准公钥指数 (65537 -> 0x010001)
	     * 5. BASE62: 客户端生成 16 字节随机密钥所用的 62 进制字符集
	     */
	    private static final String WEAPI_NONCE = "0CoJUm6Qyw8W8jud";
	    private static final String WEAPI_IV = "0102030405060708";
	    private static final String WEAPI_RSA_PUBLIC_KEY = "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a873aea8a5aa0d6e18389f7f144a1e3050c1bbe22a14370046e52989c5732d0e47773871ea7a49c00dab9d69d19147fc56b7cd93a81a3e56f323476ec85e6dab88838702b6e238c65f040816377b00fd6039197fb173914a063c61eeb";
	    private static final String WEAPI_RSA_EXPONENT = "010001";
	    private static final String BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

	    /**
	     * WEAPI 双层 AES-CBC + RSA 混合加密算法
	     * @param text 待加密的明文 JSON 字符串
	     * @return 包含 params (双层 AES 密文) 与 encSecKey (RSA 加密密钥) 的表单参数 Map
	     * @throws Exception
	     */
	    public Map<String, String> weapiEncrypt(String text) throws Exception {
	        // Step 1: 客户端生成 16 字节随机 AES 密钥 (secretKey)
	        StringBuilder sb = new StringBuilder();
	        Random random = new Random();
	        for (int i = 0; i < 16; i++) {
	            sb.append(BASE62.charAt(random.nextInt(BASE62.length())));
	        }
	        String secretKey = sb.toString();

	        // Step 2: 双层 AES-128-CBC 加密 (第一层使用固定 NONCE，第二层使用随机 secretKey)
	        String params1 = aesCbcEncrypt(text, WEAPI_NONCE, WEAPI_IV);
	        String encParams = aesCbcEncrypt(params1, secretKey, WEAPI_IV);

	        // Step 3: 使用网易云官方 RSA 公钥模幂加密逆序后的 secretKey (生成 encSecKey)
	        String reversedKey = new StringBuilder(secretKey).reverse().toString();
	        BigInteger m = new BigInteger(WEAPI_RSA_PUBLIC_KEY, 16);
	        BigInteger e = new BigInteger(WEAPI_RSA_EXPONENT, 16);
	        BigInteger b = new BigInteger(1, reversedKey.getBytes(StandardCharsets.UTF_8));
	        String encSecKey = b.modPow(e, m).toString(16);
	        while (encSecKey.length() < 256) {
	            encSecKey = "0" + encSecKey;
	        }

	        Map<String, String> map = new HashMap<>();
	        map.put("params", encParams);
	        map.put("encSecKey", encSecKey);
	        return map;
	    }

	    /**
	     * AES-128-CBC 加密工具函数 (PKCS5Padding, Base64 输出)
	     */
	    private static String aesCbcEncrypt(String text, String key, String iv) throws Exception {
	        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
	        Key secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "AES");
	        IvParameterSpec ivSpec = new IvParameterSpec(iv.getBytes(StandardCharsets.UTF_8));
	        cipher.init(Cipher.ENCRYPT_MODE, secretKey, ivSpec);
	        byte[] encrypted = cipher.doFinal(text.getBytes(StandardCharsets.UTF_8));
	        return Base64.getEncoder().encodeToString(encrypted);
	    }

	    /**
	     * 通过网易云官方 Web 端 WEAPI 协议发送请求 (免设备指纹风控校验)
	     * @param url 请求目标端点 (如 https://music.163.com/weapi/playlist/subscribe)
	     * @param data 请求参数负载 (自动追加 csrf_token)
	     * @return 响应 JSON 字符串 (如网易云返回 HTTP 200 空内容则自动封装为标准成功 JSON)
	     * @throws Exception
	     */
	    public String requestWeapi(String url, Map<String, Object> data) throws Exception {
	        if (data == null) {
	            data = new HashMap<>();
	        }
	        if (!data.containsKey("csrf_token")) {
	            data.put("csrf_token", "");
	        }
	        Map<String, String> formParams = weapiEncrypt(com.alibaba.fastjson.JSON.toJSONString(data));

	        Map<String, String> headers = new LinkedHashMap<>();
	        headers.put("Referer", "https://music.163.com/");
	        headers.put("Origin", "https://music.163.com");
	        headers.put("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
	        headers.put("Cookie", this.cookie != null ? this.cookie : "");

	        String resp = HttpClientUtil.postForm(url, headers, formParams);
	        if (resp == null || resp.trim().isEmpty()) {
	            return "{\"code\":200,\"message\":\"success\"}";
	        }
	        return resp;
	    }

	    private static final String LINUX_KEY = "rFgB&h#%2?^eDg:Q";

	    /**
	     * 通过网易云官方 Linux Forward 接口代理请求 (用于无风控写操作)
	     */
	    public String requestLinuxApi(String innerUrl, Map<String, Object> innerParams) throws Exception {
	        Map<String, Object> body = new LinkedHashMap<>();
	        body.put("method", "POST");
	        body.put("url", innerUrl);
	        body.put("params", innerParams);

	        String jsonBody = com.alibaba.fastjson.JSON.toJSONString(body);
	        String eparams = aesEncryptECB(jsonBody, LINUX_KEY);

	        Map<String, String> headers = new LinkedHashMap<>();
	        headers.put("Referer", "https://music.163.com/");
	        headers.put("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36");
	        headers.put("Cookie", this.cookie != null ? this.cookie : "");

	        Map<String, String> params = new LinkedHashMap<>();
	        params.put("eparams", eparams);

	        String resp = HttpClientUtil.postForm("https://music.163.com/api/linux/forward", headers, params);
	        log.info("Linux API response for {}: {}", innerUrl, resp);
	        return resp;
	    }

	    /**
	     * 收藏 / 取消收藏歌单 (使用 WEAPI 协议，永不报 405)
	     * @param playlistId 歌单 ID
	     * @param subscribe true 为收藏，false 为取消收藏
	     * @return 响应 JSON
	     * @throws Exception
	     */
	    public String subscribePlaylist(Long playlistId, boolean subscribe) throws Exception {
	        if (playlistId == null || playlistId <= 0) {
	            throw new IllegalArgumentException("playlistId 不能为空");
	        }
	        String url = subscribe 
	            ? "https://music.163.com/weapi/playlist/subscribe" 
	            : "https://music.163.com/weapi/playlist/unsubscribe";
	        
	        Map<String, Object> data = new HashMap<>();
	        data.put("id", playlistId);

	        return requestWeapi(url, data);
	    }

	    /**
	     * 歌单曲目操作 (添加 / 移除)
	     * @param playlistId 歌单 ID
	     * @param op 操作类型: "add" 添加, "del" 移除
	     * @param trackIds 歌曲 ID 列表
	     * @return Linux API 响应 JSON
	     * @throws Exception
	     */
	    public String manipulateTracks(Long playlistId, String op, List<Long> trackIds) throws Exception {
	        if (playlistId == null || playlistId <= 0) {
	            throw new IllegalArgumentException("playlistId 不能为空");
	        }
	        if (trackIds == null || trackIds.isEmpty()) {
	            throw new IllegalArgumentException("trackIds 不能为空");
	        }
	        String innerUrl = "http://music.163.com/api/playlist/manipulate/tracks";
	        Map<String, Object> innerParams = new LinkedHashMap<>();
	        innerParams.put("op", op);
	        innerParams.put("pid", playlistId);
	        innerParams.put("trackIds", com.alibaba.fastjson.JSON.toJSONString(trackIds));

	        return requestLinuxApi(innerUrl, innerParams);
	    }

	    public String addTracksToPlaylist(Long playlistId, List<Long> trackIds) throws Exception {
	        return manipulateTracks(playlistId, "add", trackIds);
	    }

	    public String removeTracksFromPlaylist(Long playlistId, List<Long> trackIds) throws Exception {
	        return manipulateTracks(playlistId, "del", trackIds);
	    }

	    /**
	     * 创建新自建歌单
	     * @param name 歌单名称
	     * @param isPrivate 是否私密
	     * @return Linux API 响应 JSON
	     * @throws Exception
	     */
	    public String createPlaylist(String name, boolean isPrivate) throws Exception {
	        if (name == null || name.trim().isEmpty()) {
	            throw new IllegalArgumentException("歌单名称不能为空");
	        }
	        String innerUrl = "http://music.163.com/api/playlist/create";
	        Map<String, Object> innerParams = new LinkedHashMap<>();
	        innerParams.put("name", name.trim());
	        innerParams.put("privacy", isPrivate ? 10 : 0);

	        return requestLinuxApi(innerUrl, innerParams);
	    }

	    /**
	     * 删除自建歌单
	     * @param playlistId 歌单 ID
	     * @return Linux API 响应 JSON
	     * @throws Exception
	     */
	    public String deletePlaylist(Long playlistId) throws Exception {
	        if (playlistId == null || playlistId <= 0) {
	            throw new IllegalArgumentException("playlistId 不能为空");
	        }
	        String innerUrl = "http://music.163.com/api/playlist/delete";
	        Map<String, Object> innerParams = new LinkedHashMap<>();
	        innerParams.put("pid", playlistId);

	        return requestLinuxApi(innerUrl, innerParams);
	    }

	    public static void main(String[] args) throws Exception {
	    	NeteaseAPIService service = new NeteaseAPIService();
	    	service.cookie = "1234"; 
	        //String json = service.urlV1(589938L, "lossless");
	        //System.out.println(json);
	        
	        //String json1 = service.songDetail( Lists.newArrayList(589938L) );
	        //System.out.println(json1);
	        
	        //String lyricJson = service.getLyric(589938L);
	        //System.out.println(lyricJson);
	    	
	    	//String detailJson = service.getPlaylistDetail(13615904765L);
	        //System.out.println(detailJson);
	    	
	    	//String albumjson = service.getAlbumDetail(274821019L); 
	        //System.out.println(albumjson);
	    	
	    	 //String searchresult = service.searchMusic("周杰伦", 10, 0, 1);
	    	 //System.out.println(searchresult);
	    	
	    	
	    	//String userPlayList = service.getUserPlaylist(321664453L, 20, 0); 
	        //System.out.println(userPlayList);
	    	
	    	
	    	//Long id = service.getAccountInfo();
	    	//System.out.println(id);
	    }

		
}
