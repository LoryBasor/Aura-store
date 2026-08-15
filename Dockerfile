# Utilisation de l'image Node 22 slim pour Debian Bookworm
FROM node:22-bookworm-slim

# Définition des variables d'environnement de base pour la production
ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=3000

# Création du répertoire de travail
WORKDIR /app

# Installation des dépendances système nécessaires pour Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Création des dossiers nécessaires et attribution des permissions au répertoire /app
# Fait au préalable pour éviter un "chown -R" lourd après la copie des fichiers
RUN mkdir -p uploads sessions/whatsapp logs .wwebjs_auth \
    && chown -R node:node /app

# Copie des fichiers de dépendances avec attribution directe à l'utilisateur node
COPY --chown=node:node package*.json ./

# Installation des dépendances de production
RUN npm ci --omit=dev

# Copie du reste du code source en appliquant la propriété node:node
COPY --chown=node:node . .

# Passage à l'utilisateur non-root pour l'exécution
USER node

# Exposition du port utilisé par l'API
EXPOSE $PORT

# Tini s'assure que les signaux d'arrêt sont bien transmis aux sous-processus
ENTRYPOINT ["/usr/bin/tini", "--"]

# Commande par défaut pour démarrer l'application
CMD ["npm", "start"]