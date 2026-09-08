package com.wyyyyydl;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.scheduling.annotation.EnableScheduling;

import com.wyyyyydl.config.NativeRuntimeHints;

@SpringBootApplication
@EnableScheduling
@ImportRuntimeHints(NativeRuntimeHints.class)
public class WyyyyyDlApplication {

	public static void main(String[] args) {
		SpringApplication.run(WyyyyyDlApplication.class, args);
	}

}
