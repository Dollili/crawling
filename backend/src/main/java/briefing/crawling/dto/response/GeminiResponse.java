package briefing.crawling.dto.response;

public class GeminiResponse {
    public enum Status {
        SUCCESS,
        SAFETY_BLOCKED,
        MAX_TOKENS_EXCEEDED,
        NO_CANDIDATES,
        API_ERROR,
        RETRY_EXHAUSTED
    }

    private final Status status;
    private final String text;
    private final String errorMessage;

    private GeminiResponse(Status status, String text, String errorMessage) {
        this.status = status;
        this.text = text;
        this.errorMessage = errorMessage;
    }

    public static GeminiResponse success(String text) {
        return new GeminiResponse(Status.SUCCESS, text, null);
    }

    public static GeminiResponse failure(Status status, String errorMessage) {
        return new GeminiResponse(status, null, errorMessage);
    }

    public boolean isSuccess() {
        return status == Status.SUCCESS;
    }

    public Status getStatus() {
        return status;
    }

    public String getText() {
        return text;
    }

    public String getErrorMessage() {
        return errorMessage;
    }
}
