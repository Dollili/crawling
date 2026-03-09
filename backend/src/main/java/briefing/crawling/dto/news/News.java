package briefing.crawling.dto.news;

import java.time.OffsetDateTime;

public class News {
    private long id;
    private String title;
    private String media;
    private OffsetDateTime writeDateTime;
    private String url;
    private OffsetDateTime createDateTime;

    public OffsetDateTime getCreateDateTime() {
        return createDateTime;
    }

    public void setCreateDateTime(OffsetDateTime createDateTime) {
        this.createDateTime = createDateTime;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getMedia() {
        return media;
    }

    public void setMedia(String media) {
        this.media = media;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public OffsetDateTime getWriteDateTime() {
        return writeDateTime;
    }

    public void setWriteDateTime(OffsetDateTime writeDateTime) {
        this.writeDateTime = writeDateTime;
    }
}
