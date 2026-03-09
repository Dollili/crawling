package briefing.crawling.dto.request;

public class CollectRequest {
    private String keyword = "";

    public CollectRequest(String keyword) {
        this.keyword = keyword;
    }

    public String getKeyword() {
        return keyword;
    }
}
