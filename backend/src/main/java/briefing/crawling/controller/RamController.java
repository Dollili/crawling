package briefing.crawling.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import briefing.crawling.dto.rams.Rams;
import briefing.crawling.dto.request.RamRequest;
import briefing.crawling.service.RamsService;

@RestController
@RequestMapping("/api/rams")
public class RamController {

    private final RamsService ramsService;

    public RamController(RamsService ramsService) {
        this.ramsService = ramsService;
    }

    @PostMapping
    public ResponseEntity<List<Rams>> getRams(@RequestBody RamRequest keyword) {
        List<Rams> list = ramsService.getRamsList(keyword);
        return ResponseEntity.ok(list);
    }

    // @GetMapping("/collect")
    // public ResponseEntity<?> getCollectRequest() {
    //     ramsService.insertRams();
    //     return ResponseEntity.ok().build();
    // }
}
