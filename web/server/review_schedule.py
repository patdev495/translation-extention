"""FSRS policy for scheduled vocabulary reviews."""

from datetime import UTC, datetime, timedelta
from typing import Literal

from fsrs import Card, Rating, Scheduler

VocabularyRating = Literal["again", "hard", "good", "easy"]
RATINGS: dict[VocabularyRating, Rating] = {
    "again": Rating.Again,
    "hard": Rating.Hard,
    "good": Rating.Good,
    "easy": Rating.Easy,
}
NEW_CARDS_PER_DAY = 20
DAY_MS = 86_400_000

scheduler = Scheduler(
    desired_retention=0.9,
    learning_steps=(timedelta(minutes=1), timedelta(minutes=10)),
    relearning_steps=(timedelta(minutes=10),),
    enable_fuzzing=False,
)


def review_card(card_json: str | None, rating: VocabularyRating, now_ms: int) -> tuple[Card, int]:
    now = datetime.fromtimestamp(now_ms / 1000, UTC)
    card = Card.from_json(card_json) if card_json is not None else Card(due=now)
    updated, _ = scheduler.review_card(card, RATINGS[rating], review_datetime=now)
    return updated, round(updated.due.timestamp() * 1000)
