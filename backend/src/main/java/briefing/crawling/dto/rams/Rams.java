package briefing.crawling.dto.rams;

import java.time.OffsetDateTime;

public class Rams {
    private long id;
    private String ramType;
    private String ramSize;
    private int currentPrice;
    private OffsetDateTime registerDate;
    private OffsetDateTime createDateTime;

    public OffsetDateTime getCreateDateTime() {
        return createDateTime;
    }

    public void setCreateDateTime(OffsetDateTime createDateTime) {
        this.createDateTime = createDateTime;
    }

    public int getCurrentPrice() {
        return currentPrice;
    }

    public void setCurrentPrice(int currentPrice) {
        this.currentPrice = currentPrice;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getRamSize() {
        return ramSize;
    }

    public void setRamSize(String ramSize) {
        this.ramSize = ramSize;
    }

    public String getRamType() {
        return ramType;
    }

    public void setRamType(String ramType) {
        this.ramType = ramType;
    }

    public OffsetDateTime getRegisterDate() {
        return registerDate;
    }

    public void setRegisterDate(OffsetDateTime registerDate) {
        this.registerDate = registerDate;
    }
}
