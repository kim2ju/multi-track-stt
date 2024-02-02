package com.yonseiaws5.gamehelper;

import org.springframework.web.bind.annotation.*;

@RestController
public class HelloController {

    @GetMapping("/")
    public String Hello() {
        return "Hello";
    }
}
