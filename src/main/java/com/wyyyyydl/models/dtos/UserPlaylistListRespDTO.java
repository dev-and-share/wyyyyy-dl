package com.wyyyyydl.models.dtos;

import java.util.List;

import lombok.Data;

@Data
public class UserPlaylistListRespDTO {
	private List<UserPlaylistSummaryDTO> playlists;

    private Integer total;

    private Integer status;
}
