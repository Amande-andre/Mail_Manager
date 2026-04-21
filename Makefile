# **************************************************************************** #
#                                                                              #
#                                                         :::      ::::::::    #
#    Makefile                                           :+:      :+:    :+:    #
#                                                     +:+ +:+         +:+      #
#    By: amande <amande@student.42.fr>              +#+  +:+       +#+         #
#                                                 +#+#+#+#+#+   +#+            #
#    Created: 2023/10/01 00:00:00 by amande           #+#    #+#              #
#    Updated: 2023/10/01 00:00:00 by amande          ###   ########.fr        #
#                                                                              #
# **************************************************************************** #

NAME		:= mailManager
PYTHON		:= python3
PIP		:= pip
TOKEN_FILE	:= token.json

all: setup

setup:
	@echo "Configuration de l'environnement virtuel et des dépendances Google..."
	$(PYTHON) -m venv .
	. bin/activate && $(PIP) install --upgrade $(PIP)
	. bin/activate && $(PIP) install google-api-python-client google-auth-httplib2 google-auth-oauthlib

clean:
	@echo "Nettoyage du token d'authentification..."
	rm -f $(TOKEN_FILE)

fclean: clean
	@echo "Nettoyage complet (environnement virtuel + token)..."
	rm -rf bin include lib lib64 pyvenv.cfg

re: fclean all

.PHONY: all setup clean fclean re