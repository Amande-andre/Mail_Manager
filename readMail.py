import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Portée (lecture seule serait mieux, mais on garde ton scope actuel)
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

def authentifier_gmail():
    """Charge les identifiants depuis token.json"""
    if not os.path.exists("token.json"):
        raise Exception("token.json introuvable. Lance d'abord un script d'authentification.")
    return Credentials.from_authorized_user_file("token.json", SCOPES)

def lister_emails(service, max_results):
    """Affiche les derniers emails"""
    if max_results == 0:
        max_results = 10
    results = service.users().messages().list(userId="me", maxResults=max_results).execute()
    messages = results.get("messages", [])

    if not messages:
        print("Aucun email trouvé.")
        return

    print(f"\n {len(messages)} derniers emails :\n")

    for message in messages:
        msg = service.users().messages().get(
            userId="me",
            id=message["id"],
            format="metadata"
        ).execute()

        headers = msg["payload"]["headers"]

        expediteur = next((h["value"] for h in headers if h["name"] == "From"), "Inconnu")
        sujet = next((h["value"] for h in headers if h["name"] == "Subject"), "(Pas de sujet)")

        print(f"De : {expediteur}")
        print(f"Sujet : {sujet}\n")

def main(argv):
    creds = authentifier_gmail()
    service = build("gmail", "v1", credentials=creds)
    lister_emails(service, argv)

import sys
if __name__ == "__main__":
    main(sys.argv[1])