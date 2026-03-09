package briefing.crawling.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;

import briefing.crawling.dto.news.News;
import briefing.crawling.dto.news.Summary;

@Mapper
public interface NewsMapper {

    List<News> getNewsList(String keyword);

    int duplicateNews(String url);

    void insertNews(List<News> newsList);

    int countSum(long id);

    String getSummary(long id);

    LocalDateTime getLastDatetime();

    void insertSummary(Summary summary);
}
