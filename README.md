# susbi-teste
Protótipo de avatar virtual interativo SUSBI

## v27 — pulsos de energia comedidos, preto que absorve a luz e ombros no lugar

- **Pulsos sorteados por região**: cada braço e cada perna recebem de 1 a 3 pulsos a cada ~5 s, e o tronco de 2 a 4 a cada 5 a 10 s. O momento, a trilha e o sentido de cada pulso são sorteados. As trilhas paradas não brilham mais (acabou o efeito "árvore de natal").
- `corpo_dados.webp` foi refeito: cada trilha tem um número único dentro da sua região do corpo (tronco, braço esq./dir., perna esq./dir.). `pulsos.json` lista as trilhas mais compridas de cada região e o trecho visível de cada uma.
- **Preto que absorve a luz**: o traje não tem mais nenhum reflexo (especular zerado). O fundo é quase preto absoluto e as trilhas ficam em branco fosco.
- **Ombros**: as animações do Meshy sobem as clavículas ~25° acima do natural (ombro encolhido, parecendo ombreira). A página traz as clavículas de volta para perto da posição natural do modelo, guardando 20% do movimento (`OMBRO_FIXO`). Isso vale para todas as animações, inclusive as próximas.
