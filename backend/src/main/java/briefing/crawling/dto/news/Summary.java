package briefing.crawling.dto.news;

public class Summary {
    private long id;
    private long newsId;
    private String summary;
    private String createDateTime;

    public long getNewsId() {
        return newsId;
    }

    public void setNewsId(long newsId) {
        this.newsId = newsId;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }
}
