# SUSBI — teste do modelo do Blender no navegador

Página: `blender/index.html`. Ela abre o `susbi.glb` (2,9 MB), exportado da revisão 20 do Blender.

## O que tem no modelo
- **Corpo:** cerca de 158 mil triângulos, com o relevo do original num mapa de normais. As linhas do traje acendem em ciano.
- **Cabeça:**
  - formas da boca para a fala (`Fala O`, `Fala U`, `Fala E`, `Fala I`, `Fala M B P` e `Fala F V`), além de `Piscar` e `Respirar`;
  - os pontos e as linhas do rosto ficam numa textura luminosa;
  - as linhas flutuantes de trás viraram tubos finos.
- **Esqueleto** com nomes no padrão Mixamo (`mixamorig...`), incluindo dedos, mandíbula (`Jaw`) e olhos (`LeftEye` e `RightEye`).
- **Animações:** `SUSBI entrada (LEMBRAI)`, `SUSBI caminhar (no lugar)` e `SUSBI falar (teste)`.

## O que a página faz
- **Ao abrir:** a SUSBI entra pela esquerda caminhando, vira para a câmera e a câmera fecha no close do ombro para cima.
- **Durante o uso:** ela pisca e respira sozinha, e mexe os olhos.
- **Testar fala:** usa a voz do navegador e escolhe as formas da boca pelo texto.
- **Voz original:** toca o áudio de `3d/assets` e mexe a boca pelo volume.
- **Ouvir:** usa o reconhecimento de voz do Chrome e depois repete o que ouviu.
- **Controles manuais:** expressão, virar a cabeça, olhar para os lados e abrir a boca.

## Crédito
O corpo é baseado em "Android Remake | Adroid fighter girl", de lawlietrecluze (Sketchfab), sob licença CC BY 4.0. Foi modificado.
