from google.auth.exceptions import RefreshError
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

from app import config
from app.gmail import SCOPES


def main():
    if not config.GMAIL_CREDENTIALS_PATH.exists():
        raise FileNotFoundError(
            "credentials.json introuvable. Placez-le à la racine ou définissez "
            "GMAIL_CREDENTIALS_PATH."
        )

    creds = None
    if config.GMAIL_TOKEN_PATH.exists():
        try:
            creds = Credentials.from_authorized_user_file(
                str(config.GMAIL_TOKEN_PATH), SCOPES
            )
        except (ValueError, RefreshError) as exc:
            print(f"Token invalide: {exc}. Génération d'un nouveau token.")

    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(
            str(config.GMAIL_CREDENTIALS_PATH), SCOPES
        )
        creds = flow.run_local_server(port=0)
        config.GMAIL_TOKEN_PATH.write_text(creds.to_json())

    print("Authentification Gmail terminée. token.json est prêt.")


if __name__ == "__main__":
    main()
