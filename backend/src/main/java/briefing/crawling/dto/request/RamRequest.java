package briefing.crawling.dto.request;

public class RamRequest {
    private String ramType;
    private String ramSize;

    public RamRequest() {}

    public RamRequest(String ramType, String ramSize) {
        this.ramType = ramType;
        this.ramSize = ramSize;
    }

    public String getRamType() {
        return ramType;
    }

    public String getRamSize() {
        return ramSize;
    }
}
