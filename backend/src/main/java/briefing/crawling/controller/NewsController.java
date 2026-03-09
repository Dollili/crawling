package briefing.crawling.controller;

import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import briefing.crawling.dto.request.CollectRequest;
import briefing.crawling.dto.news.News;
import briefing.crawling.dto.request.SummaryRequest;
import briefing.crawling.service.NewsService;

@RestController
@RequestMapping("/api/news")
public class NewsController {

    private final NewsService newsService;

    public NewsController(NewsService newsService) {
        this.newsService = newsService;
    }

    @PostMapping
    public ResponseEntity<List<News>> getNews(@RequestBody CollectRequest keyword) {
        String key = keyword.getKeyword();
        List<News> list = newsService.getNewsList(key);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/summary/{id}")
    public ResponseEntity<String> getSummary(@PathVariable long id) {
        String summary = newsService.getSummary(id);
        return ResponseEntity.ok(summary);
    }

    @PostMapping("/summary/generate")
    public ResponseEntity<String> generateSummary(@RequestBody SummaryRequest sq) {
        String summary = newsService.generateSummary(sq);
        return ResponseEntity.ok(summary);
    }

    @GetMapping(value = "/summary/stream/{id}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> streamSummary(
        @PathVariable long id,
        @RequestParam String url,
        @RequestParam String title
    ) {
        SseEmitter emitter = new SseEmitter(60_000L);

        SummaryRequest sq = new SummaryRequest();
        sq.setId(id);
        sq.setUrl(url);
        sq.setTitle(title);

        newsService.streamSummary(sq, emitter);

        HttpHeaders headers = new HttpHeaders();
        headers.set("Cache-Control", "no-cache");
        headers.set("X-Accel-Buffering", "no"); // Render 배포 환경
        return ResponseEntity.ok().headers(headers).body(emitter);
    }
}
