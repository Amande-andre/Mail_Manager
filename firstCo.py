import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.exceptions import RefreshError

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

def authentifier_gmail():
    creds = None
    # Si le fichier token.json existe, chargez les identifiants
    if os.path.exists("token.json"):
        try:
            creds = Credentials.from_authorized_user_file("token.json", SCOPES)
        except (ValueError, RefreshError) as e:
            print(f"Erreur de chargement du token : {e}. Un nouveau token sera généré.")

    # Si les identifiants ne sont pas valides, lancez le flux d'authentification
    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
        creds = flow.run_local_server(port=0)
        # Sauvegardez les identifiants pour la prochaine utilisation
        with open("token.json", "w") as token:
            token.write(creds.to_json())
    return creds

def main():
    creds = authentifier_gmail()
    service = build("gmail", "v1", credentials=creds)
    print("Authentification réussie ! Vous pouvez maintenant interagir avec l'API Gmail.")

if __name__ == "__main__":
    main()