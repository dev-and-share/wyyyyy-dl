package com.pewee.neteasemusic.models.dtos;

import lombok.Data;

@Data
public class ArtistAnalysisRespDTO {
    private ArtistInfoDTO artist;
    private Integer status;
}
