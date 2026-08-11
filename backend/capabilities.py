import logging
from typing import Dict, Any, List, Optional
from backend.models import Agent

logger = logging.getLogger("zpay.capabilities")

# Authoritative registry of permitted tools for the AI Agents
AGENT_TOOLS_REGISTRY = {
    "Flight Search API": {
        "name": "Flight Search API",
        "description": "Query available flights between cities.",
        "input_schema": {
            "type": "object",
            "properties": {
                "from_city": {"type": "string"},
                "to_city": {"type": "string"}
            },
            "required": ["from_city", "to_city"]
        },
        "category": "travel",
        "limit": 0.05,  # Max cost allowed in XLM
        "provider_info": {
            "name": "ZPay Travel Hub",
            "payout_address": "GBBD47NESK5CX7D7RMM6YW7QD66JHBIZ4KCO62D2CBEEOCOZAFSU7G3O"
        }
    },
    "Currency API": {
        "name": "Currency API",
        "description": "Convert foreign exchange currency rates.",
        "input_schema": {
            "type": "object",
            "properties": {
                "base": {"type": "string"},
                "target": {"type": "string"}
            },
            "required": ["base", "target"]
        },
        "category": "data",
        "limit": 0.01,
        "provider_info": {
            "name": "ZPay Data Portal",
            "payout_address": "GBBD47NESK5CX7D7RMM6YW7QD66JHBIZ4KCO62D2CBEEOCOZAFSU7G3O"
        }
    },
    "Translation API": {
        "name": "Translation API",
        "description": "Translate content text between languages.",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string"},
                "target_lang": {"type": "string"}
            },
            "required": ["text", "target_lang"]
        },
        "category": "translation",
        "limit": 0.02,
        "provider_info": {
            "name": "ZPay Linguistic Services",
            "payout_address": "GBBD47NESK5CX7D7RMM6YW7QD66JHBIZ4KCO62D2CBEEOCOZAFSU7G3O"
        }
    },
    "AI Analysis API": {
        "name": "AI Analysis API",
        "description": "Process and analyze flight and travel options.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "data_context": {"type": "string"}
            },
            "required": ["query"]
        },
        "category": "ai",
        "limit": 0.05,
        "provider_info": {
            "name": "ZPay AI Analytics Hub",
            "payout_address": "GBBD47NESK5CX7D7RMM6YW7QD66JHBIZ4KCO62D2CBEEOCOZAFSU7G3O"
        }
    }
}

class AgentCapabilities:
    @staticmethod
    def validate_tool_call(agent: Agent, tool_name: str, args: Dict[str, Any], cost: float) -> dict:
        """
        Validate that the tool call complies with the agent's capability bounds.
        Returns: {'valid': bool, 'error': Optional[str]}
        """
        tool = AGENT_TOOLS_REGISTRY.get(tool_name)
        if not tool:
            return {"valid": False, "error": f"Tool '{tool_name}' is not registered as an authorized agent capability."}

        # Verify category allowed by policy
        policy = agent.policy
        if policy:
            allowed_categories = policy.allowed_categories or []
            if tool["category"] not in allowed_categories:
                return {"valid": False, "error": f"Tool category '{tool['category']}' is not permitted by agent policy."}

            blocked_categories = policy.blocked_categories or []
            if tool["category"] in blocked_categories:
                return {"valid": False, "error": f"Tool category '{tool['category']}' is blocked by agent policy."}

        # Check maximum tool cost limits
        if cost > tool["limit"]:
            return {"valid": False, "error": f"Tool call cost {cost} XLM exceeds tool limit limit of {tool['limit']} XLM."}

        # Validate input schema keys
        schema = tool["input_schema"]
        required_keys = schema.get("required", [])
        for key in required_keys:
            if key not in args:
                return {"valid": False, "error": f"Missing required parameter '{key}' in tool invocation args."}

        return {"valid": True, "error": None}
