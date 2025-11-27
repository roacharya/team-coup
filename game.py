# game.py
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Literal


Role = Literal["Duke", "Assassin", "Captain", "Ambassador", "Contessa"]
Team = Literal["A", "B"]
Phase = Literal[
    "lobby",
    "action_selection",
    "challenge_window",
    "block_window",
    "swap_choice",
    "loss_choice",
    "game_over",
]


class InvalidMove(Exception):
    pass


@dataclass
class Player:
    player_id: str
    name: str
    team: Team
    coins: int = 0
    cards: List[Role] = field(default_factory=list)
    alive: bool = True

    @property
    def num_cards(self) -> int:
        return len(self.cards)


@dataclass
class PendingAction:
    actor_id: str
    action: str
    target_id: Optional[str]
    requires_role: Optional[Role]
    requires_two: bool = False
    cost: int = 0
    refundable: bool = False  # for Super Assassin refund


@dataclass
class PendingBlock:
    blocker_id: str
    block_type: str
    requires_role: Optional[Role]
    requires_two: bool = False


class GameState:
    def __init__(self, game_id: str, mode: str):
        self.game_id = game_id
        self.mode = mode  # "normal_team" | "super_team"

        self.phase: Phase = "lobby"
        self.players: Dict[str, Player] = {}
        self.turn_order: List[str] = []
        self.current_player_index: int = 0

        self.logs: List[str] = []

        self.teams: Dict[Team, List[str]] = {"A": [], "B": []}

        # Deck & revealed influence
        self.deck: List[Role] = []
        self.revealed_cards: List[Role] = []

        self.winner_team: Optional[Team] = None

        self.pending_action: Optional[PendingAction] = None
        self.pending_block: Optional[PendingBlock] = None

        # Ambassador exchange
        self.exchange_actor_id: Optional[str] = None
        self.exchange_cards: Optional[List[Role]] = None

        # Loss-choice
        self.loss_choice_player_id: Optional[str] = None
        # post-loss behavior:
        # "resolve_action" | "cancel_action" | "block_stands" | "block_fails" | None
        self._post_loss_action: Optional[str] = None
        self._next_turn_after_loss: bool = False

    # ──────────────────────────────────────────────────────────────────────
    # Lobby & setup
    # ──────────────────────────────────────────────────────────────────────

    def add_player(self, name: str, team: str) -> str:
        if self.phase != "lobby":
            raise InvalidMove("Cannot join after game start")
        if team not in ("A", "B"):
            raise InvalidMove("Invalid team")

        player_id = f"p{len(self.players) + 1}"
        player = Player(player_id=player_id, name=name, team=team)
        self.players[player_id] = player
        self.teams[team].append(player_id)
        self.logs.append(f"{name} joined Team {team}.")
        return player_id

    def start_game(self) -> None:
        if self.phase != "lobby":
            raise InvalidMove("Game already started")

        n_players = len(self.players)
        if n_players not in (4, 6):
            raise InvalidMove("Need exactly 4 or 6 players")

        if len(self.teams["A"]) != len(self.teams["B"]):
            raise InvalidMove("Teams must have the same number of players")

        # Alternating order: A1, B1, A2, B2, ...
        team_a = sorted(self.teams["A"])
        team_b = sorted(self.teams["B"])
        order: List[str] = []
        for a, b in zip(team_a, team_b):
            order.append(a)
            order.append(b)

        self.turn_order = order
        self.current_player_index = 0

        # Deck: 3 of each role
        roles: List[Role] = ["Duke", "Assassin", "Captain", "Ambassador", "Contessa"]
        self.deck = roles * 3
        random.shuffle(self.deck)

        # Deal 2, start with 0 coins (team coup)
        for pid in self.turn_order:
            p = self.players[pid]
            p.cards = [self._draw_card(), self._draw_card()]
            p.coins = 0
            p.alive = True

        self.phase = "action_selection"
        self.logs.append(
            "Game started. Turn order: "
            + ", ".join(self.players[pid].name for pid in self.turn_order)
        )

    # ──────────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────────

    def _draw_card(self) -> Role:
        if not self.deck:
            raise InvalidMove("Deck is empty")
        return self.deck.pop()

    def _current_player_id(self) -> str:
        return self.turn_order[self.current_player_index]

    def _assert_current_player(self, player_id: str):
        if self.phase != "action_selection":
            raise InvalidMove("Not in action selection phase")
        if player_id != self._current_player_id():
            raise InvalidMove("It is not your turn")

    def _log(self, msg: str):
        self.logs.append(msg)

    def _alive_players_in_team(self, team: Team) -> List[str]:
        return [pid for pid in self.teams[team] if self.players[pid].num_cards > 0]

    def _check_victory(self) -> None:
        alive_a = self._alive_players_in_team("A")
        alive_b = self._alive_players_in_team("B")
        if alive_a and alive_b:
            return
        if alive_a and not alive_b:
            self.winner_team = "A"
            self.phase = "game_over"
            self._log("Team A wins!")
        elif alive_b and not alive_a:
            self.winner_team = "B"
            self.phase = "game_over"
            self._log("Team B wins!")

    def _advance_turn(self) -> None:
        if self.phase == "game_over":
            return
        for _ in range(len(self.turn_order)):
            self.current_player_index = (self.current_player_index + 1) % len(
                self.turn_order
            )
            pid = self.turn_order[self.current_player_index]
            if self.players[pid].num_cards > 0:
                break

    def _is_blockable_action(self, action: str) -> bool:
        # Actions that go through challenge_window first, then can be blocked
        return action in ("steal", "super_steal", "assassinate", "super_assassinate")

    def _replace_claim_card(self, player: Player, role: Role) -> None:
        """
        When a claim (action or block) is successfully defended,
        the claimed card is shuffled back into the deck and the player
        draws a replacement card. This is private; only the log says
        that they drew a new card, not which card it is.
        """
        try:
            idx = player.cards.index(role)
        except ValueError:
            # Shouldn't happen if we already checked counts, but be safe.
            return

        # Put the revealed card back into the deck and draw a replacement.
        self.deck.append(role)
        random.shuffle(self.deck)
        new_card = self._draw_card()
        player.cards[idx] = new_card

        self._log(
            f"{player.name}'s {role} claim was correct. {player.name} draws a new influence card."
        )

    # ──────────────────────────────────────────────────────────────────────
    # Main action entry
    # ──────────────────────────────────────────────────────────────────────

    def player_action(self, player_id: str, action: str, target_id: Optional[str]) -> None:
        if self.phase != "action_selection":
            raise InvalidMove("Cannot act right now")
        self._assert_current_player(player_id)

        player = self.players[player_id]
        if player.num_cards == 0:
            raise InvalidMove("You have no influence")

        # Super abilities require two copies of that role (except Super Coup)
        if (
            action.startswith("super_")
            and action != "super_coup"
            and player.num_cards < 2
        ):
            raise InvalidMove("You need two copies of that role to use its super ability")

        # Forced coup thresholds:
        # normal_team: 10+ coins must coup
        # super_team:  11+ coins must coup
        threshold = 11 if self.mode == "super_team" else 10
        allowed_coup_actions = ["coup"]
        if self.mode == "super_team":
            allowed_coup_actions.append("super_coup")
        if player.coins >= threshold and action not in allowed_coup_actions:
            raise InvalidMove(f"At {threshold}+ coins you must coup")

        # Validate target/team restrictions
        target = None
        if target_id is not None:
            if target_id not in self.players:
                raise InvalidMove("Invalid target")
            target = self.players[target_id]
            if target.team == player.team:
                raise InvalidMove("Cannot target your own teammate")
            if target.num_cards == 0:
                raise InvalidMove("Target has no influence")

        # Clear old state
        self.pending_action = None
        self.pending_block = None
        self.exchange_actor_id = None
        self.exchange_cards = None
        self.loss_choice_player_id = None
        self._post_loss_action = None
        self._next_turn_after_loss = False

        # Income (non-blockable)
        if action == "income":
            player.coins += 1
            self._log(f"{player.name} takes income (+1 coin).")
            self._check_victory()
            self._advance_turn()
            return

        # Foreign Aid: blockable by Duke, not challengeable
        if action == "foreign_aid":
            self.pending_action = PendingAction(
                actor_id=player_id,
                action="foreign_aid",
                target_id=None,
                requires_role=None,
                requires_two=False,
                cost=0,
                refundable=False,
            )
            self.phase = "block_window"
            self._log(f"{player.name} attempts Foreign Aid (+2 coins).")
            return

        # Coup: blockable by Super Contessa (only in super mode), not challengeable
        if action == "coup":
            if not target:
                raise InvalidMove("Coup requires a target")
            cost = 7
            if player.coins < cost:
                raise InvalidMove("Not enough coins for coup")
            player.coins -= cost
            self.pending_action = PendingAction(
                actor_id=player_id,
                action="coup",
                target_id=target_id,
                requires_role=None,
                requires_two=False,
                cost=cost,
                refundable=False,
            )
            self.phase = "block_window"
            self._log(
                f"{player.name} launches a coup on {target.name} (cost {cost})."
            )
            return

        # Super Coup: only in super_team mode (no role requirement)
        if action == "super_coup":
            if self.mode != "super_team":
                raise InvalidMove("Super Coup is only available in Super Team mode")
            if not target:
                raise InvalidMove("Super Coup requires a target")
            cost = 12
            if player.coins < cost:
                raise InvalidMove("Not enough coins for super coup")
            player.coins -= cost
            self._log(
                f"{player.name} launches a SUPER coup on {target.name} (cost {cost})."
            )
            self.pending_action = None
            self._start_loss_choice(target.player_id, post="next_turn")
            return

        # Role-based (challengeable) actions
        ROLE_ACTIONS: Dict[str, dict] = {
            "tax": {"role": "Duke", "two": False, "cost": 0, "refundable": False},
            "super_tax": {"role": "Duke", "two": True, "cost": 0, "refundable": False},
            "steal": {
                "role": "Captain",
                "two": False,
                "needs_target": True,
                "cost": 0,
                "refundable": False,
            },
            "super_steal": {
                "role": "Captain",
                "two": True,
                "needs_target": True,
                "cost": 0,
                "refundable": False,
            },
            "exchange": {
                "role": "Ambassador",
                "two": False,
                "cost": 0,
                "refundable": False,
            },
            "super_exchange": {
                "role": "Ambassador",
                "two": True,
                "cost": 0,
                "refundable": False,
            },
            "assassinate": {
                "role": "Assassin",
                "two": False,
                "needs_target": True,
                "cost": 3,
                "refundable": False,
            },
            "super_assassinate": {
                "role": "Assassin",
                "two": True,
                "needs_target": True,
                "cost": 3,
                "refundable": True,  # refund if not blocked and goes through
            },
        }

        if action not in ROLE_ACTIONS:
            raise InvalidMove(f"Unknown action: {action}")

        # No super abilities in normal_team mode
        if self.mode == "normal_team" and action.startswith("super_"):
            raise InvalidMove("Super abilities are only available in Super Team mode")

        params = ROLE_ACTIONS[action]
        role: Role = params["role"]
        requires_two = bool(params.get("two", False))
        needs_target = bool(params.get("needs_target", False))
        cost = int(params.get("cost", 0))
        refundable = bool(params.get("refundable", False))

        if needs_target and not target:
            raise InvalidMove("This action requires a target")

        if cost:
            if player.coins < cost:
                raise InvalidMove("Not enough coins for this action")
            player.coins -= cost  # cost paid up front

        self.pending_action = PendingAction(
            actor_id=player_id,
            action=action,
            target_id=target_id,
            requires_role=role,
            requires_two=requires_two,
            cost=cost,
            refundable=refundable,
        )
        self.phase = "challenge_window"

        # Cleaner logs without "claiming X"
        if target:
            if action in ("steal", "super_steal"):
                self._log(
                    f"{player.name} attempts {self._human_action(action)} from {target.name}."
                )
            elif action in ("assassinate", "super_assassinate"):
                self._log(
                    f"{player.name} attempts {self._human_action(action)} on {target.name}."
                )
            else:
                self._log(
                    f"{player.name} attempts {self._human_action(action)} on {target.name}."
                )
        else:
            self._log(f"{player.name} attempts {self._human_action(action)}.")

    # ──────────────────────────────────────────────────────────────────────
    # Challenge resolution
    # ──────────────────────────────────────────────────────────────────────

    def player_challenge(self, challenger_id: str) -> None:
        if self.phase != "challenge_window":
            raise InvalidMove("No action to challenge currently")

        challenger = self.players[challenger_id]

        # Challenge a block if present
        if self.pending_block:
            pb = self.pending_block
            blocker = self.players[pb.blocker_id]
            if challenger.team == blocker.team:
                raise InvalidMove("You cannot challenge your own teammate's block")

            role = pb.requires_role
            if not role:
                raise InvalidMove("This block cannot be challenged")

            needed = 2 if pb.requires_two else 1
            actual_count = blocker.cards.count(role)

            if actual_count >= needed:
                # Block is truthful; challenger loses card, block stands
                self._replace_claim_card(blocker, role)
                self._log(
                    f"{challenger.name} challenges {blocker.name}'s block and loses the challenge."
                )
                self._start_loss_choice(challenger_id, post="block_stands")
            else:
                # Block was a lie; blocker loses card, block fails, action goes through
                self._log(
                    f"{challenger.name} successfully challenges {blocker.name}'s block."
                )
                self._start_loss_choice(blocker.player_id, post="block_fails")
            return

        # Otherwise challenge the action itself
        if not self.pending_action:
            raise InvalidMove("No pending action")

        actor = self.players[self.pending_action.actor_id]
        if challenger.team == actor.team:
            raise InvalidMove("You cannot challenge your own teammate")

        role = self.pending_action.requires_role
        if not role:
            raise InvalidMove("This action cannot be challenged")

        needed = 2 if self.pending_action.requires_two else 1
        actual_count = actor.cards.count(role)

        if actual_count >= needed:
            # Actor truthful, challenger loses one influence, action goes through
            self._replace_claim_card(actor, role)
            self._log(
                f"{challenger.name} challenges {actor.name}'s {role} and loses the challenge."
            )
            self._start_loss_choice(challenger_id, post="resolve_action")
        else:
            # Actor lied, actor loses one influence, action cancelled
            self._log(
                f"{challenger.name} successfully challenges {actor.name}'s {role}."
            )
            self._start_loss_choice(actor.player_id, post="cancel_action")

    def player_no_challenge(self, player_id: str) -> None:
        if self.phase != "challenge_window":
            raise InvalidMove("Not in challenge window")

        # No challenge on block => block stands
        if self.pending_block:
            self._block_stands()
            return

        # No challenge on action
        if not self.pending_action:
            raise InvalidMove("No pending action")

        action = self.pending_action.action
        if self._is_blockable_action(action):
            # proceed to block window
            self.phase = "block_window"
        else:
            # directly resolve (no blocks)
            self._resolve_pending_action()

    # ──────────────────────────────────────────────────────────────────────
    # Blocking
    # ──────────────────────────────────────────────────────────────────────

    def player_block(self, player_id: str, block_type: str) -> None:
        if self.phase != "block_window":
            raise InvalidMove("Not in block window")
        if not self.pending_action:
            raise InvalidMove("No pending action to block")
        if self.pending_block is not None:
            raise InvalidMove("A block has already been declared")

        actor = self.players[self.pending_action.actor_id]
        target = (
            self.players[self.pending_action.target_id]
            if self.pending_action.target_id
            else None
        )
        blocker = self.players[player_id]
        action = self.pending_action.action

        # Determine if this block is legal and what role it claims
        if block_type == "block_foreign_aid":
            if action != "foreign_aid":
                raise InvalidMove("Cannot block this action with Duke")
            if blocker.team == actor.team:
                raise InvalidMove("You cannot block your own teammate's foreign aid")
            requires_role: Optional[Role] = "Duke"
            requires_two = False

        elif block_type in ("block_steal_captain", "block_steal_ambassador"):
            if action not in ("steal", "super_steal"):
                raise InvalidMove("Cannot block this action as Captain/Ambassador")
            if not target or blocker.player_id != target.player_id:
                raise InvalidMove("Only the target can block steal")
            if block_type == "block_steal_captain":
                requires_role = "Captain"
            else:
                requires_role = "Ambassador"
            requires_two = False

        elif block_type == "block_assassinate":
            if action not in ("assassinate", "super_assassinate"):
                raise InvalidMove("Cannot block this action as Contessa")
            if not target or blocker.player_id != target.player_id:
                raise InvalidMove("Only the target can block assassinate")
            requires_role = "Contessa"
            requires_two = False

        elif block_type == "block_coup":
            if action != "coup":
                raise InvalidMove("Only coups can be blocked by Super Contessa")
            if self.mode != "super_team":
                raise InvalidMove("Super Contessa only exists in super team mode")
            if not target or blocker.player_id != target.player_id:
                raise InvalidMove("Only the target can block the coup")
            if blocker.num_cards < 2:
                raise InvalidMove("Need two Contessas to super-block a coup")
            requires_role = "Contessa"
            requires_two = True  # Super Contessa = 2 Contessas

        else:
            raise InvalidMove("Unknown block type")

        self.pending_block = PendingBlock(
            blocker_id=player_id,
            block_type=block_type,
            requires_role=requires_role,
            requires_two=requires_two,
        )
        self.phase = "challenge_window"

        # NEW: clarify what they blocked steal with
        if block_type == "block_steal_captain":
            with_text = " with Captain"
        elif block_type == "block_steal_ambassador":
            with_text = " with Ambassador"
        else:
            with_text = ""

        self._log(
            f"{blocker.name} attempts to block {actor.name}'s {self._human_action(action)}{with_text}."
        )

    def player_no_block(self, player_id: str) -> None:
        if self.phase != "block_window":
            raise InvalidMove("Not in block window")
        if not self.pending_action:
            raise InvalidMove("No pending action to resolve")
        # First "no block" we see means no one blocks
        self._resolve_pending_action()

    def _block_stands(self) -> None:
        if not self.pending_action or not self.pending_block:
            return
        actor = self.players[self.pending_action.actor_id]
        blocker = self.players[self.pending_block.blocker_id]
        action = self.pending_action.action

        self._log(
            f"{blocker.name}'s block stands. {actor.name}'s {self._human_action(action)} is prevented."
        )
        # Action is cancelled; coins already paid stay paid (coup/assassin costs stand).
        self.pending_action = None
        self.pending_block = None
        self.phase = "action_selection"
        self._check_victory()
        self._advance_turn()

    def _block_fails(self) -> None:
        if not self.pending_action or not self.pending_block:
            return
        blocker = self.players[self.pending_block.blocker_id]
        action = self.pending_action.action
        self._log(
            f"{blocker.name}'s block fails. {self._human_action(action)} goes through."
        )
        self.pending_block = None
        self._resolve_pending_action()

    # ──────────────────────────────────────────────────────────────────────
    # Loss-choice handling
    # ──────────────────────────────────────────────────────────────────────

    def _start_loss_choice(self, player_id: str, post: Optional[str]) -> None:
        if player_id not in self.players:
            raise InvalidMove("Invalid loss-choice player")

        victim = self.players[player_id]
        if victim.num_cards == 0:
            self._post_loss_action = None
            self._next_turn_after_loss = False
            return

        self.loss_choice_player_id = player_id
        self.phase = "loss_choice"
        self._post_loss_action = post
        self._next_turn_after_loss = post == "next_turn"

    def choose_loss_card(self, player_id: str, card_index: int) -> None:
        if self.phase != "loss_choice":
            raise InvalidMove("Not choosing a card to lose right now")
        if player_id != self.loss_choice_player_id:
            raise InvalidMove("You are not the one choosing a card to lose")

        victim = self.players[player_id]
        if not (0 <= card_index < victim.num_cards):
            raise InvalidMove("Invalid card index")

        lost = victim.cards.pop(card_index)
        self.revealed_cards.append(lost)
        self._log(f"{victim.name} loses influence ({lost}).")

        if victim.num_cards == 0:
            victim.alive = False
            self._log(f"{victim.name} is eliminated.")
        self.loss_choice_player_id = None

        self._check_victory()
        if self.phase == "game_over":
            return

        post = self._post_loss_action
        self._post_loss_action = None

        if post == "resolve_action":
            self._resolve_pending_action()
        elif post == "cancel_action":
            self.pending_action = None
            self.pending_block = None
            self.phase = "action_selection"
            self._advance_turn()
        elif post == "block_stands":
            self._block_stands()
        elif post == "block_fails":
            self._block_fails()
        elif self._next_turn_after_loss:
            self._next_turn_after_loss = False
            self.phase = "action_selection"
            self._advance_turn()
        else:
            # default: back to action_selection (rare)
            self.phase = "action_selection"

    # ──────────────────────────────────────────────────────────────────────
    # Pending action resolution (after challenges / blocks)
    # ──────────────────────────────────────────────────────────────────────

    def _resolve_pending_action(self) -> None:
        pa = self.pending_action
        if not pa:
            return

        actor = self.players[pa.actor_id]
        target = self.players[pa.target_id] if pa.target_id else None
        action = pa.action

        # Foreign Aid (after no block)
        if action == "foreign_aid":
            actor.coins += 2
            self._log(f"{actor.name} gains 2 coins from Foreign Aid.")
            self.pending_action = None
            self.phase = "action_selection"
            self._check_victory()
            self._advance_turn()
            return

        # Coup (after no super Contessa block)
        if action == "coup":
            if not target:
                self.pending_action = None
                self.phase = "action_selection"
                self._advance_turn()
                return
            self._log(f"{actor.name}'s coup on {target.name} goes through.")
            self.pending_action = None
            self._start_loss_choice(target.player_id, post="next_turn")
            return

        # Tax / Super Duke
        if action in ("tax", "super_tax"):
            gain = 3 if action == "tax" else 5
            actor.coins += gain
            self._log(f"{actor.name} gains {gain} coins from Duke.")
            self.pending_action = None
            self._check_victory()
            self.phase = "action_selection"
            self._advance_turn()
            return

        # Steal / Super Steal
        if action in ("steal", "super_steal"):
            if not target:
                self.pending_action = None
                self.phase = "action_selection"
                self._advance_turn()
                return
            if target.coins <= 0:
                self._log(
                    f"{actor.name} attempts to steal from {target.name}, but they have no coins."
                )
                self.pending_action = None
                self._check_victory()
                self.phase = "action_selection"
                self._advance_turn()
                return

            amount = 2 if action == "steal" else 3
            take = min(amount, target.coins)
            target.coins -= take
            actor.coins += take
            self._log(
                f"{actor.name} steals {take} coin(s) from {target.name} as Captain."
            )
            self.pending_action = None
            self._check_victory()
            self.phase = "action_selection"
            self._advance_turn()
            return

        # Ambassador / Super Ambassador
        if action in ("exchange", "super_exchange"):
            draw_count = 2 if action == "exchange" else 3
            self._start_exchange(actor.player_id, draw_count)
            self.pending_action = None
            return

        # Assassin / Super Assassin
        if action in ("assassinate", "super_assassinate"):
            if not target:
                self.pending_action = None
                self.phase = "action_selection"
                self._advance_turn()
                return
            if action == "super_assassinate" and pa.cost and pa.refundable:
                actor.coins += pa.cost
                self._log(
                    f"{actor.name} keeps their {pa.cost} coins from Super Assassin."
                )
            self.pending_action = None
            self._start_loss_choice(target.player_id, post="next_turn")
            return

        # Fallback
        self.pending_action = None
        self.phase = "action_selection"
        self._advance_turn()

    # ──────────────────────────────────────────────────────────────────────
    # Ambassador exchange
    # ──────────────────────────────────────────────────────────────────────

    def _start_exchange(self, actor_id: str, draw_count: int) -> None:
        actor = self.players[actor_id]
        drawn: List[Role] = []
        for _ in range(draw_count):
            if not self.deck:
                break
            drawn.append(self._draw_card())

        pool = actor.cards + drawn
        self.exchange_actor_id = actor_id
        self.exchange_cards = pool
        self.phase = "swap_choice"
        self._log(f"{actor.name} looks at {len(pool)} cards with Ambassador.")

    def finish_exchange(self, player_id: str, keep_indices: List[int]) -> None:
        if self.phase != "swap_choice":
            raise InvalidMove("Not in Ambassador exchange")
        if player_id != self.exchange_actor_id:
            raise InvalidMove("You are not exchanging right now")
        if self.exchange_cards is None:
            raise InvalidMove("No exchange cards available")

        actor = self.players[player_id]
        pool = self.exchange_cards

        if len(keep_indices) != actor.num_cards:
            raise InvalidMove("You must keep exactly your number of cards")

        if any(i < 0 or i >= len(pool) for i in keep_indices):
            raise InvalidMove("Invalid index in keep_indices")

        keep_set = set(keep_indices)
        new_hand = [pool[i] for i in sorted(keep_set)]
        returned = [pool[i] for i in range(len(pool)) if i not in keep_set]

        actor.cards = new_hand
        self.deck.extend(returned)
        random.shuffle(self.deck)

        self.exchange_actor_id = None
        self.exchange_cards = None
        self.phase = "action_selection"
        self._log(f"{actor.name} completes Ambassador exchange.")
        self._check_victory()
        self._advance_turn()

    # ──────────────────────────────────────────────────────────────────────
    # Public view
    # ──────────────────────────────────────────────────────────────────────

    def to_public_view(self, viewer_id: str) -> dict:
        players_view: Dict[str, dict] = {}
        for pid, p in self.players.items():
            players_view[pid] = {
                "player_id": p.player_id,
                "name": p.name,
                "team": p.team,
                "coins": p.coins,
                "alive": p.num_cards > 0,
                "num_cards": p.num_cards,
                "cards": p.cards[:] if pid == viewer_id else None,
            }

        if self.pending_action:
            pending_action = {
                "actor_id": self.pending_action.actor_id,
                "action": self.pending_action.action,
                "target_id": self.pending_action.target_id,
            }
        else:
            pending_action = None

        if self.pending_block:
            pending_block = {
                "blocker_id": self.pending_block.blocker_id,
                "block_type": self.pending_block.block_type,
            }
        else:
            pending_block = None

        exchange_pool_size = 0
        exchange_cards_view: Optional[List[Role]] = None
        if self.exchange_cards is not None and self.exchange_actor_id is not None:
            exchange_pool_size = max(
                0,
                len(self.exchange_cards)
                - self.players[self.exchange_actor_id].num_cards,
            )
            if viewer_id == self.exchange_actor_id and self.phase == "swap_choice":
                exchange_cards_view = list(self.exchange_cards)

        loss_choice_cards: Optional[List[Role]] = None
        if self.phase == "loss_choice" and self.loss_choice_player_id == viewer_id:
            loss_choice_cards = self.players[viewer_id].cards[:]

        return {
            "game_id": self.game_id,
            "mode": self.mode,
            "phase": self.phase,
            "you": viewer_id,
            "current_player": self._current_player_id()
            if self.phase not in ("lobby", "game_over")
            else None,
            "turn_order": self.turn_order[:],
            "players": players_view,
            "winner_team": self.winner_team,
            "logs": self.logs[:],
            "pending_action": pending_action,
            "pending_block": pending_block,
            "exchange_pool_size": exchange_pool_size,
            "exchange_cards": exchange_cards_view,
            "loss_choice_player_id": self.loss_choice_player_id,
            "loss_choice_cards": loss_choice_cards,
            "deck_size": len(self.deck),
            "revealed_cards": self.revealed_cards[:],
        }

    # ──────────────────────────────────────────────────────────────────────
    # Human-friendly action names
    # ──────────────────────────────────────────────────────────────────────

    def _human_action(self, action: str) -> str:
        if action == "tax":
            return "Duke"
        if action == "super_tax":
            return "Super Duke"
        if action == "exchange":
            return "Ambassador"
        if action == "super_exchange":
            return "Super Ambassador"
        if action == "steal":
            return "Captain steal"
        if action == "super_steal":
            return "Super Captain steal"
        if action == "assassinate":
            return "Assassin"
        if action == "super_assassinate":
            return "Super Assassin"
        if action == "foreign_aid":
            return "Foreign Aid"
        if action == "coup":
            return "Coup"
        if action == "super_coup":
            return "Super Coup"
        return action
