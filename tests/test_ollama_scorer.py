import pytest
from unittest.mock import patch, MagicMock
from src.scoring.ollama_scorer import score_candidate_ollama, is_ollama_available, OllamaModel, ScoreResult


class TestScoreCandidateOllama:
    @patch('src.scoring.ollama_scorer.httpx.Client')
    def test_success_embeddings_endpoint(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value.__enter__.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.json.return_value = {"embedding": [0.1] * 384}
        mock_response.raise_for_status.return_value = None
        mock_client.post.return_value = mock_response
        
        jd = "Python developer with Flask"
        cv = "Python engineer with Flask"
        result = score_candidate_ollama(jd, cv, OllamaModel.NOMIC_EMBED, top_k=5)
        
        assert result is not None
        assert isinstance(result, ScoreResult)
        assert 0.0 <= result.score <= 1.0
        assert result.raw_breakdown["method"] == "ollama"
        assert result.raw_breakdown["model"] == "nomic-embed-text"
        assert result.raw_breakdown["endpoint"] == "embeddings"

    @patch('src.scoring.ollama_scorer.httpx.Client')
    def test_success_chat_endpoint_llama(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value.__enter__.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": "0.85"}
        }
        mock_response.raise_for_status.return_value = None
        mock_client.post.return_value = mock_response
        
        jd = "Python developer with Flask"
        cv = "Python engineer with Flask"
        result = score_candidate_ollama(jd, cv, OllamaModel.LLAMA31_8B, top_k=5)
        
        assert result is not None
        assert isinstance(result, ScoreResult)
        assert result.raw_breakdown["endpoint"] == "chat"

    @patch('src.scoring.ollama_scorer.httpx.Client')
    def test_connection_refused_returns_none(self, mock_client_class):
        import httpx
        mock_client = MagicMock()
        mock_client_class.return_value.__enter__.return_value = mock_client
        mock_client.post.side_effect = httpx.ConnectError("Connection refused")
        
        result = score_candidate_ollama("JD", "CV", OllamaModel.NOMIC_EMBED)
        assert result is None

    @patch('src.scoring.ollama_scorer.httpx.Client')
    def test_timeout_returns_none(self, mock_client_class):
        import httpx
        mock_client = MagicMock()
        mock_client_class.return_value.__enter__.return_value = mock_client
        mock_client.post.side_effect = httpx.TimeoutException("Timeout")
        
        result = score_candidate_ollama("JD", "CV", OllamaModel.NOMIC_EMBED)
        assert result is None

    @patch('src.scoring.ollama_scorer.httpx.Client')
    def test_404_model_not_found_returns_none(self, mock_client_class):
        import httpx
        mock_client = MagicMock()
        mock_client_class.return_value.__enter__.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_client.post.return_value = mock_response
        mock_client.post.return_value.raise_for_status.side_effect = httpx.HTTPStatusError("404", request=MagicMock(), response=mock_response)
        
        result = score_candidate_ollama("JD", "CV", OllamaModel.NOMIC_EMBED)
        assert result is None

    @patch('src.scoring.ollama_scorer.httpx.Client')
    def test_invalid_json_response_returns_none(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value.__enter__.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_response.raise_for_status.return_value = None
        mock_client.post.return_value = mock_response
        
        result = score_candidate_ollama("JD", "CV", OllamaModel.NOMIC_EMBED)
        assert result is None


class TestIsOllamaAvailable:
    @patch('src.scoring.ollama_scorer.httpx.Client')
    def test_available_returns_true(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value.__enter__.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.json.return_value = {"models": [{"name": "nomic-embed-text"}]}
        mock_response.raise_for_status.return_value = None
        mock_client.get.return_value = mock_response
        
        assert is_ollama_available() is True

    @patch('src.scoring.ollama_scorer.httpx.Client')
    def test_unavailable_returns_false(self, mock_client_class):
        import httpx
        mock_client = MagicMock()
        mock_client_class.return_value.__enter__.return_value = mock_client
        mock_client.get.side_effect = httpx.ConnectError("Connection refused")
        
        assert is_ollama_available() is False

    @patch('src.scoring.ollama_scorer.httpx.Client')
    def test_timeout_returns_false(self, mock_client_class):
        import httpx
        mock_client = MagicMock()
        mock_client_class.return_value.__enter__.return_value = mock_client
        mock_client.get.side_effect = httpx.TimeoutException("Timeout")
        
        assert is_ollama_available() is False


class TestOllamaModelEnum:
    def test_models_defined(self):
        assert OllamaModel.LLAMA31_8B == "llama3.1:8b"
        assert OllamaModel.NOMIC_EMBED == "nomic-embed-text"
        assert OllamaModel.MXBAI_EMBED == "mxbai-embed-large"