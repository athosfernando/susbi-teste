# susbi-teste
Protótipo de avatar virtual interativo SUSBI

## v28 — energia correndo nas trilhas, câmera no mouse, rotina própria e pescoço sem emenda

- **Pulsos que correm**: cada trilha foi dividida em pedaços contínuos no corpo (pela posição 3D de cada ponto da roupa). Cada pedaço tem 6 a 23 cm e recebe um número próprio. O pulso escolhe um pedaço e corre de uma ponta à outra a 9–16 cm/s, com rastro de ~3,5 cm. Frequência: 1 a 3 por braço/perna a cada ~5 s; 2 a 4 no tronco a cada 5 a 10 s.
  - Scripts: `v28_circuito.py` (número sequencial por trilha), `v28_bake_posicao.py` (posição 3D) e `v28_mapa_final.py` (pedaços, `corpo_dados.webp` e `pulsos.json`).
- **Câmera no mouse/dedos**: arrastar gira, a roda do mouse ou a pinça dá zoom, e o botão direito ou dois dedos movem a câmera. Ela fica onde você deixou. Volta para a automática no botão "🎥 Câmera automática" ou depois de 25 s sem mexer.
- **Rotina própria**: de corpo inteiro, ela alterna sozinha entre andar, gestos e alongamento (qualquer animação que não seja fala, parada, caminhada ou giro entra na rotina, inclusive as próximas) e ficar parada olhando ao redor.
  - Quando você fala com ela (ou toca nela sem arrastar), ela olha para você na hora, termina o gesto em curso, para de andar e vira de frente. A câmera se aproxima do rosto e, na primeira vez, ela acena.
  - Depois de 25 s sem conversa, volta para a rotina.
- **Pescoço**: a pele da cabeça escurece aos poucos, do queixo até a borda da roupa, e vira o mesmo preto do traje. A medida é feita ao longo do pescoço, então acompanha os movimentos.
- **Correção**: um gesto que já tinha terminado uma vez ficava pausado e travava ao ser sorteado de novo.

## v27 — pulsos de energia comedidos, preto que absorve a luz e ombros no lugar

- **Pulsos sorteados por região**: cada braço e cada perna recebem de 1 a 3 pulsos a cada ~5 s, e o tronco de 2 a 4 a cada 5 a 10 s. O momento, a trilha e o sentido de cada pulso são sorteados. As trilhas paradas não brilham mais (acabou o efeito "árvore de natal").
- `corpo_dados.webp` foi refeito: cada trilha tem um número único dentro da sua região do corpo (tronco, braço esq./dir., perna esq./dir.). `pulsos.json` lista as trilhas mais compridas de cada região e o trecho visível de cada uma.
- **Preto que absorve a luz**: o traje não tem mais nenhum reflexo (especular zerado). O fundo é quase preto absoluto e as trilhas ficam em branco fosco.
- **Ombros**: as animações do Meshy sobem as clavículas ~25° acima do natural (ombro encolhido, parecendo ombreira). A página traz as clavículas de volta para perto da posição natural do modelo, guardando 20% do movimento (`OMBRO_FIXO`). Isso vale para todas as animações, inclusive as próximas.
