package briefing.crawling.error;

import java.util.Map;

import org.apache.ibatis.javassist.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.servlet.http.HttpServletRequest;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<?> handleMissingParam(MissingServletRequestParameterException ex) {
        logger.warn("[파라미터 누락] {}", ex.getMessage());
        return ResponseEntity.badRequest().body(Map.of("result", "필수 파라미터 누락: " + ex.getParameterName()));
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<?> handleNotFoundException(final Exception ex, final HttpServletRequest request) {
        logger.error(ex.getMessage(), ex);
        return ResponseEntity.status(404).body(Map.of("result", "Not Found"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleException(final Exception ex, final HttpServletRequest request) {
        logger.error(ex.getMessage(), ex);
        return ResponseEntity.status(500).body(Map.of("result", "Internal Server Error"));
    }
}
