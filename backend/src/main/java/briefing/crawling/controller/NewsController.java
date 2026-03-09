package briefing.crawling.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

}
