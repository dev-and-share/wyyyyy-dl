package com.pewee.neteasemusic.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.pewee.neteasemusic.enums.CommonRespInfo;
import com.pewee.neteasemusic.models.common.RespEntity;

@Controller
public class UiVersionController {

    @ResponseBody
    @GetMapping("/api/ui-version")
    public RespEntity<String> switchVersion(@RequestParam("v") String v, HttpServletResponse response) {
        String ver = "legacy".equals(v) ? "legacy" : "svelte";
        Cookie c = new Cookie("ui_version", ver);
        c.setPath("/");
        c.setMaxAge(31536000);
        response.addCookie(c);
        return RespEntity.apply(CommonRespInfo.SUCCESS, ver);
    }
}
