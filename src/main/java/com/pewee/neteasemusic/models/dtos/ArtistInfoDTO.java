package com.pewee.neteasemusic.models.dtos;

import java.util.List;
import lombok.Data;

@Data
public class ArtistInfoDTO {
    private Long id;
    private String name;
    private String coverImgUrl;
    private String briefDesc;
    private Integer musicSize;
    private Integer albumSize;
    private List<TrackDTO> songs;
}
