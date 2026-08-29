package com.pewee.neteasemusic.models.dtos;

import lombok.Data;

@Data
public class TrackDTO {
	
	//专辑名
	private String album;
	
	//作者
	private String artists;
	
	//id
	private Long id;
	
	//track名字
	private String name;
	
	//pic url
	private String picUrl;
	
	//是否本地已下载/存在
	private Boolean isLocal;
}
