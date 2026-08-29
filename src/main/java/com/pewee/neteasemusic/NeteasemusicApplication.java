package com.pewee.neteasemusic;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.scheduling.annotation.EnableScheduling;

import com.pewee.neteasemusic.config.NativeRuntimeHints;

@SpringBootApplication
@EnableScheduling
@ImportRuntimeHints(NativeRuntimeHints.class)
public class NeteasemusicApplication {

	public static void main(String[] args) {
		SpringApplication.run(NeteasemusicApplication.class, args);
	}

}
