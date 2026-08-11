import logging
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.x402_middleware import x402_payment_required

router = APIRouter(prefix="/api/x402", tags=["x402-paid-services"])
logger = logging.getLogger("zpay.paid_services")

@router.get("/flights")
@x402_payment_required(service_name="Flight Search API", category="travel", default_price=0.020, asset="XLM")
async def get_flights(
    request: Request,
    from_city: str = "Delhi",
    to_city: str = "Dubai",
    db: Session = Depends(get_db)
):
    logger.info(f"Access granted to Flight Search API for request: {from_city} -> {to_city}")
    return {
        "success": True,
        "service": "Flight Search API",
        "search_parameters": {
            "from": from_city,
            "to": to_city
        },
        "flights": [
            {
                "airline": "IndiGo",
                "flight_number": "6E-23",
                "departure": "16:20",
                "arrival": "18:35",
                "duration": "3h 45m",
                "price_inr": 18450.0,
                "price_usd": 221.0,
                "type": "Direct"
            },
            {
                "airline": "Air India",
                "flight_number": "AI-915",
                "departure": "18:00",
                "arrival": "20:25",
                "duration": "3h 55m",
                "price_inr": 20100.0,
                "price_usd": 240.0,
                "type": "Direct"
            },
            {
                "airline": "Emirates",
                "flight_number": "EK-513",
                "departure": "10:35",
                "arrival": "12:50",
                "duration": "3h 45m",
                "price_inr": 31200.0,
                "price_usd": 373.0,
                "type": "Direct"
            },
            {
                "airline": "SpiceJet",
                "flight_number": "SG-15",
                "departure": "14:15",
                "arrival": "16:40",
                "duration": "3h 55m",
                "price_inr": 17200.0,
                "price_usd": 206.0,
                "type": "Direct"
            }
        ]
    }

@router.get("/currency")
@x402_payment_required(service_name="Currency API", category="data", default_price=0.001, asset="XLM")
async def get_currency(
    request: Request,
    base: str = "USD",
    target: str = "INR",
    db: Session = Depends(get_db)
):
    logger.info(f"Access granted to Currency API for query: {base} -> {target}")
    # Simulating actual conversion rates
    rates = {
        "USD": {"INR": 83.45, "AED": 3.67, "EUR": 0.92},
        "AED": {"INR": 22.72, "USD": 0.27, "EUR": 0.25},
        "INR": {"USD": 0.012, "AED": 0.044, "EUR": 0.011}
    }
    
    base_upper = base.upper()
    target_upper = target.upper()
    
    rate = rates.get(base_upper, {}).get(target_upper, 1.0)
    
    return {
        "success": True,
        "service": "Currency Conversion API",
        "base": base_upper,
        "target": target_upper,
        "rate": rate,
        "timestamp": "2026-08-10T00:00:00Z"
    }

@router.get("/translation")
@x402_payment_required(service_name="Translation API", category="translation", default_price=0.005, asset="XLM")
async def get_translation(
    request: Request,
    text: str = "",
    target_lang: str = "ar",
    db: Session = Depends(get_db)
):
    logger.info(f"Access granted to Translation API for target language: {target_lang}")
    
    # Mock translation dictionary
    translations = {
        "ar": {
            "Research the cheapest flight options from Delhi to Dubai and summarize the best options.": "ابحث عن أرخص خيارات الطيران من دلهي إلى دبي ولخص أفضل الخيارات.",
            "Indigo offers the cheapest flight at ₹18,450. Air India is ₹20,100. Emirates is premium at ₹31,200.": "تقدم إنديجو أرخص رحلة طيران بسعر 18450 روبية. طيران الهند هو 20100 روبية. طيران الإمارات ممتاز بسعر 31200 روبية.",
            "Flight Search API": "واجهة برمجة تطبيقات البحث عن الرحلات الجوية",
            "Currency API": "واجهة برمجة تطبيقات العملات",
            "Translation API": "واجهة برمجة تطبيقات الترجمة",
            "AI Analysis API": "واجهة برمجة تطبيقات التحليل بالذكاء الاصطناعي"
        },
        "hi": {
            "Research the cheapest flight options from Delhi to Dubai and summarize the best options.": "दिल्ली से दुबई के लिए सबसे सस्ते उड़ान विकल्पों की शोध करें और सर्वोत्तम विकल्पों का सारांश दें।",
            "Indigo offers the cheapest flight at ₹18,450. Air India is ₹20,100. Emirates is premium at ₹31,200.": "इंडिगो ₹18,450 पर सबसे सस्ती उड़ान प्रदान करता है। एअर इंडिया ₹20,100 है। एमिरेट्स ₹31,200 पर प्रीमियम है।"
        }
    }
    
    lang = target_lang.lower()
    translated_text = translations.get(lang, {}).get(text, f"[Translated to {target_lang}]: {text}")
    
    return {
        "success": True,
        "service": "Translation API",
        "original_text": text,
        "translated_text": translated_text,
        "target_lang": target_lang
    }

@router.get("/analysis")
@x402_payment_required(service_name="AI Analysis API", category="ai", default_price=0.030, asset="XLM")
async def get_analysis(
    request: Request,
    query: str = "",
    data_context: str = "",
    db: Session = Depends(get_db)
):
    logger.info("Access granted to AI Analysis API")
    
    # Simulate a sophisticated analysis based on flights data and query
    summary = (
        "Based on live search results for flights from Delhi (DEL) to Dubai (DXB):\n\n"
        "1. **Cheapest Option**: SpiceJet (SG-15) at ₹17,200 (approx. $206 USD) departing at 14:15.\n"
        "2. **Best Value Option**: IndiGo (6E-23) at ₹18,450 (approx. $221 USD) with a highly convenient afternoon departure at 16:20.\n"
        "3. **Premium Option**: Emirates (EK-513) at ₹31,200 (approx. $373 USD) with top-tier service.\n\n"
        "Recommendation: IndiGo is recommended as the best balance between price and schedule convenience."
    )
    
    return {
        "success": True,
        "service": "AI Analysis API",
        "query": query,
        "summary": summary,
        "tokens_used": 420
    }
