"""Matières et domaines enseignés à l'ISEN Ouest

Format : un ensemble de chaînes normalisées (minuscules, sans accent pour la comparaison interne)
mappées vers leur label d'affichage canonique.

Cette liste sert à deux choses :
  1. Matcher les mots-clés extraits par YAKE contre les matières connues pour enrichir les tags.
  2. Normaliser le champ `subject` fourni par l'étudiant à l'upload.
"""

# Chaque entrée : (formes alternatives pour la détection, label canonique du tag)
_SUBJECTS_ALIASES: list[tuple[list[str], str]] = [
    # Mathématiques
    (["mathematiques", "maths", "math", "algebre", "analyse", "probabilites", "statistiques",
      "calcul differentiel", "integration", "series"], "mathématiques"),
    (["signal", "traitement du signal", "fourier", "laplace", "z-transform"], "traitement du signal"),

    # Physique
    (["physique", "mecanique", "thermodynamique", "optique", "ondes", "electricite",
      "electromagnetisme", "magnetisme", "fluides"], "physique"),
    (["electronique", "composants", "transistors", "amplificateur", "diode", "circuit"],
     "électronique"),
    (["electrotechnique", "machines electriques", "moteurs", "alternateur", "transformateur"],
     "électrotechnique"),

    # Informatique
    (["informatique", "programmation", "algorithme", "algorithmique", "structures de donnees",
      "complexite", "recursivite"], "informatique"),
    (["python", "java", "c++", "c#", "javascript", "typescript", "rust", "go", "ruby"],
     "programmation"),
    (["systemes d exploitation", "os", "linux", "unix", "windows", "processus", "threads",
      "memoire", "ordonnancement"], "systèmes d'exploitation"),
    (["reseaux", "tcp", "ip", "udp", "http", "dns", "routage", "protocoles", "wan", "lan",
      "wifi", "socket"], "réseaux"),
    (["base de donnees", "sql", "nosql", "postgresql", "mysql", "mongodb", "sgbd",
      "requetes", "transactions"], "bases de données"),
    (["web", "html", "css", "react", "angular", "vue", "nodejs", "frontend", "backend",
      "api rest", "graphql"], "développement web"),
    (["securite", "cryptographie", "chiffrement", "vulnerabilite", "pentest", "firewall",
      "authentification", "oauth", "jwt"], "sécurité informatique"),
    (["intelligence artificielle", "ia", "machine learning", "apprentissage automatique",
      "deep learning", "reseau de neurones", "neural network", "nlp", "vision par ordinateur",
      "regression", "classification", "clustering", "random forest", "gradient boosting"],
     "intelligence artificielle"),
    (["data science", "donnees", "analyse de donnees", "pandas", "numpy", "scikit",
      "visualisation"], "data science"),
    (["cloud", "aws", "azure", "gcp", "kubernetes", "docker", "devops", "ci", "cd",
      "microservices", "conteneurs"], "cloud & DevOps"),
    (["systemes embarques", "embarque", "microcontroleur", "arduino", "stm32", "fpga",
      "vhdl", "temps reel", "rtos", "iot"], "systèmes embarqués"),
    (["robotique", "robot", "ros", "capteurs", "actionneurs", "asservissement",
      "perception"], "robotique"),
    (["automatique", "automatisme", "regulation", "correcteur", "pid", "boucle fermee",
      "systeme lineaire"], "automatique"),

    # Génie industriel / management
    (["genie industriel", "lean", "qualite", "6 sigma", "production", "logistique",
      "supply chain", "gestion de projet"], "génie industriel"),
    (["management", "entrepreneuriat", "startup", "marketing", "finance", "comptabilite",
      "rh", "ressources humaines"], "management"),
    (["droit", "propriete intellectuelle", "rgpd", "contrat", "juridique"], "droit"),
    (["anglais", "english", "toeic", "langue", "communication"], "anglais"),
    (["espagnol", "spanish", "allemand", "german", "langue etrangere"], "langue étrangère"),
]

# Table aplatie : alias (minuscule) → label canonique
SUBJECT_LOOKUP: dict[str, str] = {}
for aliases, canonical in _SUBJECTS_ALIASES:
    for alias in aliases:
        SUBJECT_LOOKUP[alias] = canonical

# Ensemble des labels canoniques connus (pour normaliser `subject` saisi par l'étudiant)
KNOWN_SUBJECTS: set[str] = {canonical for _, canonical in _SUBJECTS_ALIASES}
