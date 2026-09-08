package com.wyyyyydl.controller;

import java.util.Collection;
import jakarta.annotation.Resource;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.wyyyyydl.enums.CommonRespInfo;
import com.wyyyyydl.models.common.RespEntity;
import com.wyyyyydl.models.common.DownloadTaskStatus;
import com.wyyyyydl.service.MusicDownloadService;

import lombok.extern.slf4j.Slf4j;

/**
 * 基于 Java 直接调用 API 方式解析的下载功能控制器 (v3 规范)
 * @author wyyyyy-dl
 */
@RestController
@Slf4j
@RequestMapping("/v3/download")
public class MusicDownloadController {
	
	@Resource
	private MusicDownloadService musicService;
	
	@GetMapping("/setRepeat")
	public RespEntity<String> setFlag(@RequestParam(value = "repeat") Boolean repeat) {
		musicService.setRepeat(repeat);
		return RespEntity.apply(CommonRespInfo.SUCCESS,"OK");
	}
	
	@GetMapping("/getRepeat")
	public RespEntity<Boolean> getFlag() {
		Boolean flag = musicService.getRepeat();
		return RespEntity.apply(CommonRespInfo.SUCCESS,flag);
	}
	
	@GetMapping("/single")
	public RespEntity<DownloadTaskStatus> downloadSingle(@RequestParam(value = "id") Long id) {
		musicService.downloadSingleSongV2(id);
		DownloadTaskStatus task = musicService.getDownloadTask(id);
		return RespEntity.apply(CommonRespInfo.SUCCESS, task);
	}
	
	@GetMapping("/playlist")
	public RespEntity<String> downloadPlaylist(@RequestParam(value = "id") Long id) {
		musicService.downloadPlaylistV2(id);
		return RespEntity.apply(CommonRespInfo.SUCCESS,"OK");
	}
	
	
	@GetMapping("/album")
	public RespEntity<String> downloadAlbum(@RequestParam(value = "id") Long id) {
		musicService.downloadAlbumV2(id);
		return RespEntity.apply(CommonRespInfo.SUCCESS,"OK");
	}

	@GetMapping("/tasks")
	public RespEntity<Collection<DownloadTaskStatus>> getDownloadTasks() {
		return RespEntity.apply(CommonRespInfo.SUCCESS, musicService.getDownloadTasks());
	}

	@PostMapping("/tasks/clear")
	public RespEntity<String> clearDownloadTasks() {
		musicService.clearDownloadTasks();
		return RespEntity.apply(CommonRespInfo.SUCCESS, "OK");
	}
}
