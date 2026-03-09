package briefing.crawling.service;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import com.google.genai.Client;
import com.google.genai.errors.ApiException;
import com.google.genai.types.Candidate;
import com.google.genai.types.Content;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;

import briefing.crawling.dto.response.GeminiResponse;
import briefing.crawling.dto.news.News;
import briefing.crawling.dto.news.Summary;
import briefing.crawling.dto.request.SummaryRequest;
import briefing.crawling.mapper.NewsMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class NewsService {
    private static final Logger logger = LoggerFactory.getLogger(NewsService.class);

    @Value("${rss.url}")
    private String RSS_URL;
    @Value("${ai.key}")
    private String api_key;
    @Value("${ai.prompt}")
    private String prompt;

    private Client httpClient;

    @PostConstruct
    public void init() {
        this.httpClient = Client.builder().apiKey(api_key).build();
    }

    private final NewsMapper newsMapper;

    public NewsService(NewsMapper newsMapper) {
        this.newsMapper = newsMapper;
    }

    public List<News> getNewsList(String keyword) {
        return newsMapper.getNewsList(keyword);
    }

    public OffsetDateTime getLatestDate() {
        return newsMapper.getLastDatetime();
    }

    @Scheduled(cron = "0 0 9 * * ?")
    @Transactional
    public void collect() {
        try {
            HttpURLConnection connection = (HttpURLConnection)new URL(RSS_URL).openConnection();
            connection.setRequestProperty("User-Agent", "Mozilla/5.0");

            InputStream inputStream = connection.getInputStream();

            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            org.w3c.dom.Document xmlDoc = builder.parse(inputStream);

            NodeList items = xmlDoc.getElementsByTagName("item");
            List<News> newsList = new ArrayList<>();

            DateTimeFormatter formatter = DateTimeFormatter.ofPattern(
                "EEE, dd MMM yyyy HH:mm:ss z", Locale.ENGLISH
            );

            int limit = Math.min(items.getLength(), 30);
            for (int i = 0; i < limit; i++) {
                Element item = (Element)items.item(i);

                String title = item.getElementsByTagName("title").item(0).getTextContent().trim();
                String url = item.getElementsByTagName("link").item(0).getTextContent().trim();
                String pubDate = item.getElementsByTagName("pubDate").item(0).getTextContent().trim();
                String media = item.getElementsByTagName("source").item(0) != null
                    ? item.getElementsByTagName("source").item(0).getTextContent().trim()
                    : "";

                News news = new News();
                news.setTitle(title);
                news.setUrl(url);
                news.setWriteDateTime(ZonedDateTime.parse(pubDate, formatter)
                    .withZoneSameInstant(ZoneId.of("Asia/Seoul"))
                    .toOffsetDateTime());
                news.setMedia(media);

                if (newsMapper.duplicateNews(url) > 0) {
                    continue;
                }

                newsList.add(news);
            }

            logger.info("[RSS 수집 완료] 총 {}건", newsList.size());
            if (!newsList.isEmpty()) {
                newsMapper.insertNews(newsList);
            }
        } catch (Exception e) {
            logger.error("[RSS 수집 오류] {}", e.getMessage());
        }
    }

    public String getSummary(long id) {
        if (newsMapper.countSum(id) == 0) return null;
        return newsMapper.getSummary(id);
    }

    public String generateSummary(SummaryRequest sq) {
        long id = sq.getId();
        String url = sq.getUrl();
        String title = sq.getTitle();

        StringBuilder apdPrompt = new StringBuilder();
        apdPrompt.append(prompt).append("\n");
        apdPrompt.append("기사 제목: ").append(title).append("\n");
        apdPrompt.append("링크: ").append(url).append("\n");

        GeminiResponse result = callGeminiWithRetry(apdPrompt);

        if (!result.isSuccess()) {
            logger.error("[Gemini 요약 실패] id={} status={} message={}", id, result.getStatus(), result.getErrorMessage());
            return null;
        }

        Summary summary = new Summary();
        summary.setNewsId(id);
        summary.setSummary(result.getText());
        newsMapper.insertSummary(summary);

        return result.getText();
    }

    private GeminiResponse callGeminiWithRetry(StringBuilder finPrompt) {
        GenerateContentConfig config = GenerateContentConfig.builder()
            .temperature(0.1F)
            .maxOutputTokens(2048)
            .topK(40F)
            .topP(0.8F)
            .build();

        GeminiResponse lastFailure = GeminiResponse.failure(GeminiResponse.Status.RETRY_EXHAUSTED, "최대 재시도 횟수 초과");

        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                Content content = Content.fromParts(Part.fromText(finPrompt.toString()));

                GenerateContentResponse response = httpClient.models.generateContent(
                    "gemini-3-flash-preview",
                    content,
                    config
                );

                if (response.candidates().isEmpty() || response.candidates().get().isEmpty()) {
                    lastFailure = GeminiResponse.failure(GeminiResponse.Status.NO_CANDIDATES, "응답에 Candidates가 없습니다.");
                    logger.warn("[Gemini 재시도 {}/3] {}", attempt, lastFailure.getErrorMessage());
                    if (attempt < 3) Thread.sleep(1000L * attempt);
                    continue;
                }

                Candidate candidate = response.candidates().get().getFirst();

                if (candidate.finishReason().isPresent()) {
                    String finishReason = candidate.finishReason().get().toString();
                    if ("SAFETY".equals(finishReason)) {
                        return GeminiResponse.failure(GeminiResponse.Status.SAFETY_BLOCKED, "안전 필터에 의해 차단됨");
                    } else if ("MAX_TOKENS".equals(finishReason)) {
                        return GeminiResponse.failure(GeminiResponse.Status.MAX_TOKENS_EXCEEDED, "최대 토큰 수 초과");
                    } else if (!"STOP".equals(finishReason)) {
                        lastFailure = GeminiResponse.failure(GeminiResponse.Status.API_ERROR, "모델 생성 상태 비정상: " + finishReason);
                        logger.warn("[Gemini 재시도 {}/3] {}", attempt, lastFailure.getErrorMessage());
                        if (attempt < 3) Thread.sleep(1000L * attempt);
                        continue;
                    }
                }

                String text = response.text();

                if (text == null || text.trim().isEmpty()) {
                    lastFailure = GeminiResponse.failure(GeminiResponse.Status.API_ERROR, "AI 응답이 비어있습니다.");
                    logger.warn("[Gemini 재시도 {}/3] {}", attempt, lastFailure.getErrorMessage());
                    if (attempt < 3) Thread.sleep(1000L * attempt);
                    continue;
                }

                return GeminiResponse.success(text.trim());

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return GeminiResponse.failure(GeminiResponse.Status.API_ERROR, "재시도 대기 중 인터럽트 발생");
            } catch (ApiException e) {
                lastFailure = GeminiResponse.failure(GeminiResponse.Status.API_ERROR, "API 오류: " + e.getMessage());
                logger.warn("[Gemini 재시도 {}/3] {}", attempt, lastFailure.getErrorMessage());
                if (attempt < 3) {
                    try { Thread.sleep(1000L * attempt); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                }
            } catch (Exception e) {
                lastFailure = GeminiResponse.failure(GeminiResponse.Status.API_ERROR, "알 수 없는 오류: " + e.getMessage());
                logger.warn("[Gemini 재시도 {}/3] {}", attempt, lastFailure.getErrorMessage());
                if (attempt < 3) {
                    try { Thread.sleep(1000L * attempt); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                }
            }
        }

        return lastFailure;
    }

    public void streamSummary(SummaryRequest sq, SseEmitter emitter) {
        long id = sq.getId();

        // 1. DB에 이미 요약이 존재하는 경우 → 즉시 전송
        if (newsMapper.countSum(id) > 0) {
            try {
                String existing = newsMapper.getSummary(id);
                emitter.send(SseEmitter.event().data(existing));
                emitter.send(SseEmitter.event().data("[DONE]"));
                emitter.complete();
            } catch (Exception e) {
                logger.error("[SSE 기존 요약 전송 오류] id={} {}", id, e.getMessage());
                emitter.completeWithError(e);
            }
            return;
        }

        // 2. DB에 없으면 Gemini 스트리밍 호출 (별도 스레드)
        CompletableFuture.runAsync(() -> {
            StringBuilder fullText = new StringBuilder();

            String builtPrompt = prompt + "\n"
                + "기사 제목: " + sq.getTitle() + "\n"
                + "링크: " + sq.getUrl() + "\n";

            GenerateContentConfig config = GenerateContentConfig.builder()
                .temperature(0.2F)
                .maxOutputTokens(2048)
                .topK(40F)
                .topP(0.8F)
                .build();

            try {
                Content content = Content.fromParts(Part.fromText(builtPrompt));

                // Gemini 스트리밍 호출
                httpClient.models.generateContentStream("gemini-3-flash-preview", content, config)
                    .forEach(chunk -> {
                        try {
                            String text = chunk.text();
                            if (text != null && !text.isEmpty()) {
                                fullText.append(text);
                                emitter.send(SseEmitter.event().data(text));
                            }
                        } catch (Exception e) {
                            logger.error("[SSE 청크 전송 오류] id={} {}", id, e.getMessage());
                            throw new RuntimeException(e);
                        }
                    });

                // 스트리밍 완료 후 DB 저장
                if (!fullText.isEmpty()) {
                    Summary summary = new Summary();
                    summary.setNewsId(id);
                    summary.setSummary(fullText.toString());
                    newsMapper.insertSummary(summary);
                }

                emitter.send(SseEmitter.event().data("[DONE]"));
                emitter.complete();

            } catch (Exception e) {
                logger.error("[SSE 스트리밍 오류] id={} {}", id, e.getMessage());
                try {
                    emitter.send(SseEmitter.event().data("[ERROR]"));
                    emitter.complete();
                } catch (Exception ex) {
                    emitter.completeWithError(ex);
                }
            }
        });
    }
}
