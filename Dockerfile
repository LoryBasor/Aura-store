# Utilisation de l'image Node 22 slim pour Debian Bookworm
FROM node:22-bookworm-slim

# Définition des variables d'environnement de base pour la production
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=3000

# Création du répertoire de l'application
WORKDIR /app

# Installation des dépendances système nécessaires pour Chromium
# tini est utilisé pour gérer correctement les signaux PID 1 (SIGTERM, SIGINT)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copie des fichiers de configuration NPM
COPY package*.json ./

# Installation des dépendances de production uniquement
RUN npm ci --omit=dev

# Copie du reste du code source
COPY . .

# Création des dossiers nécessaires avec les bonnes permissions
# On crée notamment le dossier pour les sessions WhatsApp qui sera monté en volume
RUN mkdir -p uploads sessions/whatsapp logs .wwebjs_auth \
    && chown -R node:node /app

# Changement d'utilisateur (bonne pratique de sécurité)
USER node

# Exposition du port utilisé par l'API
EXPOSE $PORT

# Tini s'assure que les signaux d'arrêt sont bien transmis aux sous-processus
ENTRYPOINT ["/usr/bin/tini", "--"]

# La commande par défaut démarre l'API
# Coolify surchargera cette commande pour les autres workers (ex: npm run whatsapp)
CMD ["npm", "start"]
