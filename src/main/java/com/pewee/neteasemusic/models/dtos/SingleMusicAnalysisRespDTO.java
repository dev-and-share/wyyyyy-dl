package com.pewee.neteasemusic.models.dtos;

import lombok.Data;

@Data
public class SingleMusicAnalysisRespDTO {
	
	private Long id;
	
	private String al_name;
	
	private Long al_id;
	
	private String ar_name;
	
	private String lyric;
	
	private String name;
	
	private String pic;
	
	private String size;
	
	private Integer status;
	
	private String tlyric;
	
	private String url;
	
	private Boolean freeTrial;
	
	private Integer freeTrialDuration;
	
	private String unplayableReason;
	
	private Boolean isLocal;
	
	private Object rawData;
}


