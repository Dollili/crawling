package briefing.crawling.config;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

import briefing.crawling.service.NewsService;
import briefing.crawling.service.RamsService;

@Component
public class DataFreshnessChecker implements ApplicationListener<ApplicationReadyEvent> {
    private static final Logger logger = LoggerFactory.getLogger(DataFreshnessChecker.class);

    private final NewsService newsService;
    private final RamsService ramsService;

    public DataFreshnessChecker(NewsService newsService, RamsService ramsService) {
        this.newsService = newsService;
        this.ramsService = ramsService;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        LocalDateTime latestDate = newsService.getLatestDate();
        LocalDateTime today = LocalDateTime.now();

        LocalDateTime latestDate2 = ramsService.getLatestDate();
        LocalDateTime today2 = LocalDateTime.now();

        YearMonth latestMonth = YearMonth.from(latestDate2);
        YearMonth currentMonth = YearMonth.from(today2);

        long daysDiff = ChronoUnit.DAYS.between(latestDate, today);

        if (daysDiff >= 1) {
            logger.info("News Days diff: {}", daysDiff);
            newsService.collect();
        }

        if (latestMonth.isBefore(currentMonth)) {
            logger.info("Rams Days diff: {}", daysDiff);
            ramsService.collect();
        }
    }
}
