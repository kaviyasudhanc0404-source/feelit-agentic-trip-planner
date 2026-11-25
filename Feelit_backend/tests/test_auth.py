"""Password rules and session tokens (no network or database)."""
import jwt
import pytest
from pydantic import ValidationError

from app.config import settings
from app.schemas import LoginIn, PasswordIn, RegisterIn
from app.security import create_token, public_user


def register(password: str, name: str = "Priya") -> RegisterIn:
    return RegisterIn(name=name, email="p@example.com", password=password)


def test_new_passwords_need_eight_characters_with_a_letter_and_a_number():
    assert register("travel2026").password == "travel2026"
    for weak in ("short1", "onlyletters", "12345678", "        "):
        with pytest.raises(ValidationError):
            register(weak)


def test_passwords_longer_than_bcrypt_allows_are_refused_politely():
    with pytest.raises(ValidationError, match="too long"):
        register("அ" * 30 + "1a")  # 30 Tamil letters = 90 bytes
    with pytest.raises(ValidationError, match="too long"):
        LoginIn(email="p@example.com", password="😀" * 20)


def test_names_are_tidied():
    assert register("travel2026", name="  Priya   Sharma ").name == "Priya Sharma"
    with pytest.raises(ValidationError):
        register("travel2026", name="  a ")


def test_setting_a_first_password_needs_no_current_one():
    assert PasswordIn(new_password="newpass99").current_password is None


def test_tokens_carry_the_password_version_and_profiles_say_if_a_password_exists():
    user = {"_id": "u1", "name": "Priya", "email": "p@example.com", "pv": 3}
    claims = jwt.decode(create_token(user), settings.jwt_secret, algorithms=["HS256"])
    assert (claims["sub"], claims["pv"]) == ("u1", 3)
    assert public_user(user)["has_password"] is False
    assert public_user({**user, "password_hash": "x"})["has_password"] is True


def test_mobile_numbers_are_checked_and_stored_in_one_format():
    from app.schemas import ProfileIn

    for typed in ("98765 43210", "+91 98765-43210", "09876543210", "919876543210"):
        assert ProfileIn(phone=typed).phone == "+919876543210"
    assert ProfileIn(phone="  ").phone == ""  # blank clears it
    for wrong in ("12345", "5876543210", "+1 415 555 0100", "98765abcde"):
        with pytest.raises(ValidationError):
            ProfileIn(phone=wrong)
