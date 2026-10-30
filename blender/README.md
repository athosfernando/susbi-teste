# SUSBI — teste do modelo do Blender no navegador

Página: `blender/index.html`. Ela abre o `susbi.glb` (4,1 MB), exportado da revisão 21 do Blender.

## O que tem no modelo
- **Corpo:** gerado no Meshy, reduzido para cerca de 159 mil triângulos, com as texturas do Meshy (cor, relevo, aspereza). Os filetes azuis do traje acendem.
- **Cabeça:**
  - formas da boca para a fala (`Fala O`, `Fala U`, `Fala E`, `Fala I`, `Fala M B P` e `Fala F V`), além de `Piscar` e `Respirar`;
  - os pontos e as linhas do rosto ficam numa textura luminosa;
  - as linhas flutuantes de trás viraram tubos finos.
- **Esqueleto** com nomes no padrão Mixamo (`mixamorig...`), incluindo dedos, mandíbula (`Jaw`) e olhos (`LeftEye` e `RightEye`).
- **Animações:** `SUSBI caminhar (no lugar)` é a usada pela página; `SUSBI entrada (LEMBRAI)` e `SUSBI falar (teste)` continuam no arquivo, mas a página não usa.

## O que a página faz (v22)
- **Ao abrir:** já mostra a SUSBI no close do ombro para cima (a animação de entrada foi tirada).
- **Piscar:** automático, em intervalos aleatórios de 3 a 8 s (2 a 5 s enquanto fala); às vezes pisca duas vezes. Pessoas em repouso piscam de 8 a 21 vezes por minuto.
- **Corpo vivo:** respira, balança o tronco, mexe a cabeça de leve, olha para outros lugares e volta para você. Os olhos fazem pequenos movimentos. Tudo aleatório.
- **Andar:** de vez em quando ela decide andar. A câmera abre para meio corpo ou corpo inteiro, ela vira, caminha até outro ponto, fica de frente e o close volta. Os pés ficam no chão: a velocidade acompanha a passada e o chão fica na altura da sola. O botão **Andar (teste)** força uma caminhada.
- **Microfone:** fica sempre escutando (reconhecimento de voz do Chrome). O botão vermelho **Mudo** desliga. Enquanto ela fala, não escuta a si mesma. Sem IA conectada, por enquanto ela só repete o que ouviu, com a voz do navegador, para testar a boca.
- **Traje:** mais claro e com reflexo (antes estava quase preto).
- **Controles de teste:** expressão e abrir a boca.

## Origem do corpo
O corpo foi gerado no Meshy a partir das referências da SUSBI (revisão 21).
