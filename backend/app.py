import os
import json
import base64
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI

app = Flask(__name__)
CORS(app)

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
LOGS_FILE = os.path.join(DATA_DIR, "logs.json")
MOCK_FILE = os.path.join(DATA_DIR, "mockData.json")
MENU_FILE = os.path.join(DATA_DIR, "menuDataset.json")
CHEF_MENU_FILE = os.path.join(DATA_DIR, "chefMenuDataset.json")
WEEKLY_MENU_FILE = os.path.join(DATA_DIR, "weeklyMenuDataset.json")


def read_json(path):
    with open(path, "r") as f:
        return json.load(f)


def write_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def ensure_logs_file():
    if not os.path.exists(LOGS_FILE):
        write_json(LOGS_FILE, [])


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "project": "HawkWaste", "campus": "IIT Commons"})


@app.route("/chef/menu", methods=["GET"])
def get_chef_menu():
    try:
        shift = request.args.get("shift")
        data = read_json(CHEF_MENU_FILE)
        if shift and shift in ["breakfast", "lunch", "dinner"]:
            return jsonify({
                "shift": shift,
                "metadata": data["metadata"],
                "data": data[shift],
                "daily_summary": data["daily_summary"]
            })
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/chef/compare", methods=["POST"])
def compare_cooked_vs_waste():
    try:
        body = request.get_json()
        shift = body.get("shift", "lunch")
        actual_waste_lbs = body.get("actual_waste_lbs", 0)

        chef_data = read_json(CHEF_MENU_FILE)
        shift_data = chef_data.get(shift, {})

        expected_waste = shift_data.get("shift_total_wasted_lbs_estimate", 0)
        total_cooked = shift_data.get("shift_total_cooked_lbs", 0)
        actual_waste_pct = round((actual_waste_lbs / total_cooked) * 100, 1) if total_cooked else 0
        expected_waste_pct = round((expected_waste / total_cooked) * 100, 1) if total_cooked else 0
        diff = round(actual_waste_lbs - expected_waste, 1)
        status = "over_expected" if diff > 2 else "under_expected" if diff < -2 else "on_track"

        prompt = (
            f"At IIT Commons {shift} shift today, chefs cooked {total_cooked} lbs total. "
            f"Expected waste was {expected_waste} lbs ({expected_waste_pct}%). "
            f"Actual waste measured was {actual_waste_lbs} lbs ({actual_waste_pct}%). "
            f"Difference: {diff:+} lbs. Status: {status}. "
            f"Give one specific management action in under 30 words. "
            f"If over expected, name which station to cut tomorrow. Be direct."
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=60,
        )

        insight = response.choices[0].message.content.strip()

        return jsonify({
            "shift": shift,
            "total_cooked_lbs": total_cooked,
            "expected_waste_lbs": expected_waste,
            "expected_waste_pct": expected_waste_pct,
            "actual_waste_lbs": actual_waste_lbs,
            "actual_waste_pct": actual_waste_pct,
            "difference_lbs": diff,
            "status": status,
            "management_insight": insight,
            "stations": [
                {
                    "station": s["station"],
                    "cooked_lbs": s["station_total_cooked_lbs"],
                    "expected_waste_lbs": s["station_total_wasted_lbs_estimate"]
                }
                for s in shift_data.get("stations", [])
            ]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/analyze-photo", methods=["POST"])
def analyze_photo():
    try:
        shift = request.form.get("shift", "lunch")
        image_file = request.files.get("image")

        if not image_file:
            return jsonify({"error": "No image provided"}), 400

        image_data = base64.b64encode(image_file.read()).decode("utf-8")
        mime_type = image_file.content_type or "image/jpeg"

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "This is a food waste bin at IIT Commons university dining hall. "
                                "Look at how full the bin is. "
                                "Estimate: 1) fullness as a percentage 0-100, "
                                "2) weight in pounds assuming a standard 32-gallon bin "
                                "(empty=0lbs, full=~25lbs of food waste), "
                                "3) your confidence level. "
                                "Return ONLY valid JSON, no explanation, no markdown: "
                                '{"fullness_percent": number, "estimated_lbs": number, "confidence": "low"|"medium"|"high"}'
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_data}",
                                "detail": "low",
                            },
                        },
                    ],
                }
            ],
            max_tokens=100,
        )

        raw = response.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(raw)

        log_entry = {
            "id": datetime.now().strftime("%Y%m%d%H%M%S"),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "timestamp": datetime.now().isoformat(),
            "shift": shift,
            "fullness_percent": result.get("fullness_percent", 0),
            "estimated_lbs": result.get("estimated_lbs", 0),
            "confidence": result.get("confidence", "low"),
        }

        ensure_logs_file()
        logs = read_json(LOGS_FILE)
        logs.append(log_entry)
        write_json(LOGS_FILE, logs)

        return jsonify(log_entry)

    except json.JSONDecodeError:
        return jsonify({"error": "AI returned unexpected format"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/logs", methods=["GET"])
def get_logs():
    ensure_logs_file()
    logs = read_json(LOGS_FILE)
    mock = read_json(MOCK_FILE)
    mock_logs = []
    for entry in mock.get("logs", []):
        for item in entry.get("entries", []):
            mock_logs.append({
                "date": entry["date"],
                "shift": entry["shift"],
                "station": item["station"],
                "item": item["item"],
                "waste_percent": item["wastePercent"],
                "portions_made": item["portionsMade"],
                "portions_left": item["portionsLeft"],
            })
    return jsonify({
        "photo_logs": logs,
        "item_logs": mock_logs,
        "summary": read_json(MOCK_FILE).get("weekSummary", {}),
    })


@app.route("/recommendation", methods=["GET"])
def get_recommendation():
    try:
        mock = read_json(MOCK_FILE)
        menu = read_json(MENU_FILE)
        summary = mock.get("weekSummary", {})
        worst = summary.get("worstItems", [])
        best = summary.get("bestItems", [])
        insights = menu.get("ai_recommendation_context", {}).get("key_insights", [])
        population = menu.get("ai_recommendation_context", {}).get("population_profile", {})

        worst_text = ", ".join([f"{i['item']} ({i['avgWaste']} waste)" for i in worst[:3]])
        best_text = ", ".join([f"{i['item']} ({i['avgWaste']} waste)" for i in best[:3]])
        insight_text = "; ".join(insights[:4])

        prompt = (
            f"You are a food waste analyst for IIT Commons dining hall at Illinois Institute of Technology, run by Chartwells. "
            f"Student population: {population.get('age_range', '18-35')}, "
            f"{population.get('international_students_pct', 60)}% international, "
            f"dietary restrictions include {', '.join(population.get('dietary_restrictions', []))}. "
            f"This week: highest waste items: {worst_text}. Lowest waste: {best_text}. "
            f"Key patterns observed: {insight_text}. "
            f"Total waste: {summary.get('totalWasteLbs', 0)} lbs this week. "
            f"Give ONE specific actionable recommendation. Name exact item and station. Under 40 words. No intro."
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
        )

        tip = response.choices[0].message.content.strip()

        return jsonify({
            "tip": tip,
            "worst_items": worst[:5],
            "best_items": best[:5],
            "total_waste_lbs": summary.get("totalWasteLbs", 0),
            "avg_waste_per_shift": summary.get("avgWastePerShift", 0),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/predict", methods=["GET"])
def predict_waste():
    try:
        menu = read_json(MENU_FILE)
        shift = request.args.get("shift", "lunch")

        shift_data = menu.get("menu", {}).get(shift, {})
        items = shift_data.get("items", [])

        at_risk = []
        safe = []
        for item in items:
            score = (
                item.get("familiarity", 3) +
                item.get("cultural_fit", 3) +
                item.get("visual_appeal", 3) +
                item.get("comfort_level", 3) +
                (2 if item.get("protein_present") else 0)
            )
            max_score = 18
            risk_pct = round((1 - score / max_score) * 100)
            entry = {
                "name": item["name"],
                "station": item.get("station", shift_data.get("station", "—")),
                "historical_waste_pct": item.get("historical_waste_pct", 0),
                "predicted_risk_pct": risk_pct,
                "waste_tier": item.get("waste_tier", "medium"),
                "notes": item.get("notes", ""),
                "protein_present": item.get("protein_present", False),
            }
            if item.get("waste_tier") in ["high", "critical"]:
                at_risk.append(entry)
            else:
                safe.append(entry)

        at_risk.sort(key=lambda x: x["historical_waste_pct"], reverse=True)
        safe.sort(key=lambda x: x["historical_waste_pct"])

        at_risk_text = "; ".join([
            f"{i['name']} (historically {i['historical_waste_pct']}% waste, {i['notes']})"
            for i in at_risk[:3]
        ])

        prompt = (
            f"You are predicting food waste for {shift} at IIT Commons, serving a mixed population "
            f"of undergrad, grad, faculty and staff — 60% international students. "
            f"Items most likely to waste based on menu scoring: {at_risk_text}. "
            f"Give a single pre-shift production warning in under 35 words. "
            f"Name specific items and suggest batch reduction amounts. Be direct."
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
        )

        prediction = response.choices[0].message.content.strip()

        return jsonify({
            "shift": shift,
            "prediction": prediction,
            "at_risk_items": at_risk[:5],
            "safe_items": safe[:5],
            "total_items_analyzed": len(items),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/menu", methods=["GET"])
def get_menu():
    stations = [
        "Breakfast Entree Line", "Create (Omelet Bar)",
        "Fruit and Yogurt Bar", "Bakery", "Global Kitchen",
        "Pizza", "Daily Grill", "Chef Made Soups",
    ]
    return jsonify({"location": "IIT Commons", "stations": stations})


@app.route("/menu/today", methods=["GET"])
def get_todays_menu():
    """
    Returns today's full menu cross-referenced with waste scores.
    ?date=2026-04-02  (optional — defaults to most recent available day)
    ?shift=lunch      (optional — returns all shifts if omitted)
    """
    try:
        weekly  = read_json(WEEKLY_MENU_FILE)
        scores  = read_json(MENU_FILE)

        # Build waste score lookup: item name (lowercase) → score data
        score_lookup = {}
        for shift_key in ["breakfast", "lunch", "dinner"]:
            shift_data = scores.get("menu", {}).get(shift_key, {})
            for item in shift_data.get("items", []):
                score_lookup[item["name"].lower()] = {
                    "historical_waste_pct": item.get("historical_waste_pct"),
                    "waste_tier":           item.get("waste_tier"),
                    "familiarity":          item.get("familiarity"),
                    "cultural_fit":         item.get("cultural_fit"),
                    "protein_present":      item.get("protein_present"),
                    "notes":                item.get("notes"),
                }

        requested_date = request.args.get("date")
        requested_shift = request.args.get("shift")

        # Find matching day
        days = weekly.get("days", [])
        day_data = None
        if requested_date:
            day_data = next((d for d in days if d["date"] == requested_date), None)
        if not day_data:
            day_data = days[-1] if days else None  # most recent
        if not day_data:
            return jsonify({"error": "No menu data found"}), 404

        def enrich_shift(shift_name):
            raw = day_data.get(shift_name, {})
            items = raw.get("items", []) if isinstance(raw, dict) else raw
            enriched = []
            for item in items:
                name = item.get("name", "")
                sc = score_lookup.get(name.lower(), {})
                waste_pct = item.get("waste_pct") or sc.get("historical_waste_pct")
                tier = item.get("waste_tier") or sc.get("waste_tier")

                # Derive tier from pct if still missing
                if not tier and waste_pct is not None:
                    if waste_pct >= 56:   tier = "critical"
                    elif waste_pct >= 36: tier = "high"
                    elif waste_pct >= 16: tier = "medium"
                    else:                 tier = "low"

                enriched.append({
                    "name":                 name,
                    "station":              item.get("station", ""),
                    "batch_lbs":            item.get("batch_lbs"),
                    "expected_waste_lbs":   item.get("expected_waste_lbs"),
                    "waste_pct":            waste_pct,
                    "waste_tier":           tier or "medium",
                    "historical_waste_pct": sc.get("historical_waste_pct"),
                    "familiarity":          sc.get("familiarity"),
                    "cultural_fit":         sc.get("cultural_fit"),
                    "protein_present":      sc.get("protein_present"),
                    "notes":                sc.get("notes"),
                })

            # Sort: highest waste first
            enriched.sort(key=lambda x: (x.get("waste_pct") or 0), reverse=True)
            return {
                "items":            enriched,
                "total_cooked_lbs": raw.get("total_cooked_lbs") if isinstance(raw, dict) else None,
                "total_waste_lbs":  raw.get("total_waste_lbs") if isinstance(raw, dict) else None,
                "item_count":       len(enriched),
            }

        shifts_to_return = (
            [requested_shift] if requested_shift in ["breakfast","lunch","dinner"]
            else ["breakfast","lunch","dinner"]
        )

        result = {
            "date":          day_data["date"],
            "day":           day_data["day"],
            "shifts":        {},
            "at_risk_items": [],
        }

        all_items = []
        for s in shifts_to_return:
            result["shifts"][s] = enrich_shift(s)
            for item in result["shifts"][s]["items"]:
                all_items.append({**item, "shift": s})

        # Global at-risk list: high or critical waste, sorted worst-first
        result["at_risk_items"] = sorted(
            [i for i in all_items if i.get("waste_tier") in ("high","critical")],
            key=lambda x: (x.get("waste_pct") or 0), reverse=True
        )[:8]

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/impact", methods=["GET"])
def get_impact():
    """
    Environmental impact of food waste.
    ?scope=week  (default) — uses weekSummary from mockData
    ?scope=shift&shift=lunch&date=2026-04-04 — uses a specific shift log entry
    ?lbs=42.5 — override with a raw lbs value (skips data lookup)
    """
    try:
        # Conversion constants (EPA / USDA sourced)
        CO2_PER_LB   = 1.9    # lbs CO2e per lb food waste
        WATER_PER_LB = 25.0   # gallons of embedded water per lb food
        COST_PER_LB  = 3.00   # avg institutional food cost per lb
        LBS_PER_MEAL = 1.2    # avg food per donated meal

        scope      = request.args.get("scope", "week")
        raw_lbs    = request.args.get("lbs")
        shift_arg  = request.args.get("shift", "lunch")
        date_arg   = request.args.get("date")

        if raw_lbs:
            total_lbs = float(raw_lbs)
            label = f"custom ({total_lbs} lbs)"
        elif scope == "shift":
            mock = read_json(MOCK_FILE)
            entry = None
            for log in mock.get("logs", []):
                if log["shift"] == shift_arg:
                    if date_arg is None or log["date"] == date_arg:
                        entry = log
            if not entry:
                return jsonify({"error": "Shift not found"}), 404
            total_lbs = entry["totalWasteLbs"]
            label = f"{entry['date']} {shift_arg}"
        else:
            mock = read_json(MOCK_FILE)
            total_lbs = mock["weekSummary"]["totalWasteLbs"]
            label = mock.get("week", "this week")

        co2_lbs      = round(total_lbs * CO2_PER_LB, 1)
        co2_kg       = round(co2_lbs * 0.453592, 1)
        water_gal    = round(total_lbs * WATER_PER_LB, 0)
        cost_usd     = round(total_lbs * COST_PER_LB, 2)
        meals_lost   = int(total_lbs / LBS_PER_MEAL)

        # Potential savings if waste reduced by 20%
        reduction_pct  = 0.20
        saved_lbs      = round(total_lbs * reduction_pct, 1)
        saved_co2_lbs  = round(saved_lbs * CO2_PER_LB, 1)
        saved_water    = round(saved_lbs * WATER_PER_LB, 0)
        saved_cost     = round(saved_lbs * COST_PER_LB, 2)
        saved_meals    = int(saved_lbs / LBS_PER_MEAL)
        annual_savings = round(saved_cost * 52, 2)

        return jsonify({
            "scope": label,
            "waste_lbs": total_lbs,
            "environmental_impact": {
                "co2_lbs":    co2_lbs,
                "co2_kg":     co2_kg,
                "water_gallons": int(water_gal),
                "food_cost_usd": cost_usd,
                "meals_equivalent": meals_lost,
            },
            "potential_savings_at_20pct_reduction": {
                "lbs_saved":          saved_lbs,
                "co2_lbs_avoided":    saved_co2_lbs,
                "water_gallons_saved": int(saved_water),
                "money_saved_usd":    saved_cost,
                "meals_recoverable":  saved_meals,
                "annual_money_saved": annual_savings,
            },
            "context": {
                "co2_equivalent": f"Driving a car {round(co2_kg / 0.21, 0):.0f} km",
                "water_equivalent": f"{int(water_gal / 8.34):.0f} standard bath tubs",
            }
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/batch-optimize", methods=["GET"])
def batch_optimize():
    """
    Pre-shift batch size recommendations based on historical waste.
    ?shift=breakfast|lunch|dinner  (default: lunch)
    Returns per-item recommended batch sizes and projected lbs saved.
    """
    try:
        shift = request.args.get("shift", "lunch")
        chef_data = read_json(CHEF_MENU_FILE)
        shift_data = chef_data.get(shift)

        if not shift_data:
            return jsonify({"error": f"No chef data for shift: {shift}"}), 404

        recommendations = []
        total_current_lbs = 0
        total_recommended_lbs = 0

        for station in shift_data.get("stations", []):
            for item in station.get("items", []):
                waste_pct = item.get("waste_pct_estimate", 0)
                batch_lbs = item.get("batch_lbs_cooked", 0)

                total_current_lbs += batch_lbs

                if waste_pct < 20:
                    # Low waste — no change needed
                    recommended_lbs = batch_lbs
                    action = "no_change"
                else:
                    # Reduce batch conservatively: cut 75% of the typical waste
                    cut_fraction = (waste_pct / 100) * 0.75
                    recommended_lbs = round(batch_lbs * (1 - cut_fraction), 1)
                    action = "reduce"

                lbs_saved = round(batch_lbs - recommended_lbs, 1)
                total_recommended_lbs += recommended_lbs

                recommendations.append({
                    "item":             item["name"],
                    "station":          station["station"],
                    "current_batch_lbs": batch_lbs,
                    "recommended_lbs":  recommended_lbs,
                    "lbs_saved":        lbs_saved,
                    "historical_waste_pct": waste_pct,
                    "action":           action,
                })

        recommendations.sort(key=lambda x: x["lbs_saved"], reverse=True)

        total_lbs_saved  = round(total_current_lbs - total_recommended_lbs, 1)
        co2_avoided      = round(total_lbs_saved * 1.9, 1)
        cost_avoided     = round(total_lbs_saved * 3.0, 2)

        # AI briefing for the chef
        top_cuts = [
            f"{r['item']} ({r['current_batch_lbs']} → {r['recommended_lbs']} lbs, saves {r['lbs_saved']} lbs)"
            for r in recommendations if r["action"] == "reduce"
        ][:4]
        top_cuts_text = "; ".join(top_cuts) if top_cuts else "No major cuts needed"

        prompt = (
            f"You are a sous-chef at IIT Commons. Pre-shift batch briefing for {shift}. "
            f"Recommended cuts based on historical waste: {top_cuts_text}. "
            f"Total projected savings: {total_lbs_saved} lbs, saving ${cost_avoided}. "
            f"Write a 2-sentence pre-shift briefing for the kitchen team. Direct, actionable. No intro."
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
        )
        briefing = response.choices[0].message.content.strip()

        return jsonify({
            "shift": shift,
            "chef_briefing": briefing,
            "summary": {
                "current_total_lbs":     round(total_current_lbs, 1),
                "recommended_total_lbs": round(total_recommended_lbs, 1),
                "projected_lbs_saved":   total_lbs_saved,
                "projected_co2_avoided_lbs": co2_avoided,
                "projected_cost_saved":  cost_avoided,
            },
            "items": recommendations,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    ensure_logs_file()
    app.run(debug=True, port=5000)