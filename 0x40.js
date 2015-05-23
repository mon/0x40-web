var colors = new Array();
colors[0] = 'black';
colors[1] = 'brick';
colors[2] = 'crimson';
colors[3] = 'red';
colors[4] = 'turtle';
colors[5] = 'sludge';
colors[6] = 'brown';
colors[7] = 'orange';
colors[8] = 'green';
colors[9] = 'grass';
colors[10] = 'maize';
colors[11] = 'citrus';
colors[12] = 'lime';
colors[13] = 'leaf';
colors[14] = 'chartreuse';
colors[15] = 'yellow';
colors[16] = 'midnight';
colors[17] = 'plum';
colors[18] = 'pomegranate';
colors[19] = 'rose';
colors[20] = 'swamp';
colors[21] = 'dust';
colors[22] = 'dirt';
colors[23] = 'blossom';
colors[24] = 'sea';
colors[25] = 'ill';
colors[26] = 'haze';
colors[27] = 'peach';
colors[28] = 'spring';
colors[29] = 'mantis';
colors[30] = 'brilliant';
colors[31] = 'canary';
colors[32] = 'navy';
colors[33] = 'grape';
colors[34] = 'mauve';
colors[35] = 'purple';
colors[36] = 'cornflower';
colors[37] = 'deep';
colors[38] = 'lilac';
colors[39] = 'lavender';
colors[40] = 'aqua';
colors[41] = 'steel';
colors[42] = 'grey';
colors[43] = 'pink';
colors[44] = 'bay';
colors[45] = 'marina';
colors[46] = 'tornado';
colors[47] = 'saltine';
colors[48] = 'blue';
colors[49] = 'twilight';
colors[50] = 'orchid';
colors[51] = 'magenta';
colors[52] = 'azure';
colors[53] = 'liberty';
colors[54] = 'royalty';
colors[55] = 'thistle';
colors[56] = 'ocean';
colors[57] = 'sky';
colors[58] = 'periwinkle';
colors[59] = 'carnation';
colors[60] = 'cyan';
colors[61] = 'turquoise';
colors[62] = 'powder';
colors[63] = 'white';

var waifus = [
	{
		name: "Megumi",
		file: "Megumi.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Megumi",
		source_other: "http://myanimelist.net/character/30398/Airi_Akizuki",
		fullname: "Airi Akizuki",
		align: "center"
	},
	{
		name: "Agiri",
		file: "Agiri.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Agiri",
		source_other: "http://myanimelist.net/character/33582/Agiri_Goshiki",
		fullname: "Agiri Goshiki",
		align: "center"
	},
	{
		name: "Ai",
		file: "Ai.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Ai",
		source_other: "http://myanimelist.net/character/1789/Ai_Enma",
		fullname: "Ai Enma",
		align: "left"
	},
	{
		name: "Akarin",
		file: "Akarin.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Akarin",
		source_other: "http://myanimelist.net/character/35872/Akari_Akaza",
		fullname: "Akari Akaza",
		align: "center"
	},
	{
		name: "Akatsuki",
		file: "Akatsuki.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Akatsuki",
		source_other: "http://myanimelist.net/character/81369/Akatsuki",
		fullname: "Akatsuki",
		align: "center"
	},
	{
		name: "Alice",
		file: "Alice.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Alice",
		source_other: "http://myanimelist.net/character/5582/Alice_Margatroid",
		fullname: "Alice Margatroid",
		align: "center"
	},
	{
		name: "Astraea",
		file: "Astraea.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Astraea",
		source_other: "http://myanimelist.net/character/28859/Astraea",
		fullname: "Astraea",
		align: "right"
	},
	{
		name: "Asuha",
		file: "Asuha.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Asuha",
		source_other: "http://myanimelist.net/character/41091/Asuha_Touhara",
		fullname: "Asuha Touhara",
		align: "center"
	},
	{
		name: "Asuka",
		file: "Asuka.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Asuka",
		source_other: "http://myanimelist.net/character/94/Asuka_Langley_Soryu",
		fullname: "Asuka Langley Soryu",
		align: "center"
	},
	{
		name: "Ayase",
		file: "Ayase.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Ayase",
		source_other: "http://myanimelist.net/character/37302/Ayase_Aragaki",
		fullname: "Ayase Aragaki",
		align: "center"
	},
	{
		name: "CC",
		file: "CC.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#CC",
		source_other: "http://myanimelist.net/character/1111/C.C.",
		fullname: "C.C.",
		align: "right"
	},
	{
		name: "Chika",
		file: "Chika.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Chika",
		source_other: "http://myanimelist.net/character/571/Chika_Itou",
		fullname: "Chika Itou",
		align: "center"
	},
	{
		name: "Chiri",
		file: "Chiri.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Chiri",
		source_other: "http://myanimelist.net/character/3745/Chiri_Kitsu",
		fullname: "Chiri Kitsu",
		align: "right"
	},
	{
		name: "Chitanda",
		file: "Chitanda.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Chitanda",
		source_other: "http://myanimelist.net/character/55133/Eru_Chitanda",
		fullname: "Eru Chitanda",
		align: "center"
	},
	{
		name: "Chiyo",
		file: "Chiyo.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Chiyo",
		source_other: "http://myanimelist.net/character/247/Chiyo_Mihama",
		fullname: "Chiyo Mihama",
		align: "center"
	},
	{
		name: "Cirno",
		file: "Cirno.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Cirno",
		source_other: "http://myanimelist.net/character/24891/Cirno",
		fullname: "Cirno",
		align: "center"
	},
	{
		name: "Crona",
		file: "Crona.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Crona",
		source_other: "http://myanimelist.net/character/11919/Crona",
		fullname: "Crona",
		align: "right"
	},
	{
		name: "Demon Sisters",
		file: "Demon Sisters.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Demon_Sisters",
		source_other: "http://myanimelist.net/character/37861/Kneesocks_Demon, http://myanimelist.net/character/37862/Scanty_Demon",
		fullname: "Kneesocks Demon, Scanty Demon",
		align: "center"
	},
	{
		name: "Emi",
		file: "Emi.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Emi",
		source_other: "http://katawashoujo.wikia.com/wiki/Emi_Ibarazaki",
		fullname: "Emi Ibarazaki",
		align: "center"
	},
	{
		name: "Etna",
		file: "Etna.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Etna",
		source_other: "http://myanimelist.net/character/3419/Etna",
		fullname: "Etna",
		align: "center"
	},
	{
		name: "Eureka",
		file: "Eureka.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Eureka",
		source_other: "http://myanimelist.net/character/1709/Eureka",
		fullname: "Eureka",
		align: "center"
	},
	{
		name: "Excel",
		file: "Excel.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Excel",
		source_other: "http://myanimelist.net/character/1837/Excel",
		fullname: "Excel",
		align: "right"
	},
	{
		name: "Faye",
		file: "Faye.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Faye",
		source_other: "http://myanimelist.net/character/2/Faye_Valentine",
		fullname: "Faye Valentine",
		align: "right"
	},
	{
		name: "Felli",
		file: "Felli.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Felli",
		source_other: "http://myanimelist.net/character/18951/Felli_Loss",
		fullname: "Felli Loss",
		align: "center"
	},
	{
		name: "Flandre",
		file: "Flandre.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Flandre",
		source_other: "http://myanimelist.net/character/38276/Flandre_Scarlet",
		fullname: "Flandre Scarlet",
		align: "center"
	},
	{
		name: "Fran",
		file: "Fran.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Fran",
		source_other: "http://myanimelist.net/character/12564/Fran_Madaraki",
		fullname: "Fran Madaraki",
		align: "center"
	},
	{
		name: "Fuu",
		file: "Fuu.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Fuu",
		source_other: "http://myanimelist.net/character/392/Fuu_Kasumi",
		fullname: "Fuu Kasumi",
		align: "left"
	},
	{
		name: "Galil",
		file: "Galil.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Galil",
		source_other: "http://myanimelist.net/character/62469/Galil_AR",
		fullname: "Galil AR",
		align: "center"
	},
	{
		name: "Hajime Ichinose",
		file: "Hajime Ichinose.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Hajime_Ichinose",
		source_other: "http://myanimelist.net/character/85153/Ichinose_Hajime",
		fullname: "Hajime Ichinose",
		align: "center"
	},
	{
		name: "Hakase",
		file: "Hakase.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Hakase",
		source_other: "http://myanimelist.net/character/41055/Shinonome_Hakase",
		fullname: "Hakase Shinonome",
		align: "center"
	},
	{
		name: "Hanako",
		file: "Hanako.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Hanako",
		source_other: "http://katawashoujo.wikia.com/wiki/Hanako_Ikezawa",
		fullname: "Hanako Ikezawa",
		align: "center"
	},
	{
		name: "Haruhi",
		file: "Haruhi.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Haruhi",
		source_other: "http://myanimelist.net/character/251/Haruhi_Suzumiya",
		fullname: "Haruhi Suzumiya",
		align: "right"
	},
	{
		name: "Haruhi Fujioka",
		file: "Haruhi Fujioka.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Haruhi_Fujioka",
		source_other: "http://myanimelist.net/character/18/Haruhi_Fujioka",
		fullname: "Haruhi Fujioka",
		align: "center"
	},
	{
		name: "Haruko",
		file: "Haruko.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Haruko",
		source_other: "http://myanimelist.net/character/627/Haruko_Haruhara",
		fullname: "Haruko Haruhara",
		align: "left"
	},
	{
		name: "Hitoha",
		file: "Hitoha.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Hitoha",
		source_other: "http://myanimelist.net/character/31765/Hitoha_Marui",
		fullname: "Hitoha Marui",
		align: "center"
	},
	{
		name: "Holo",
		file: "Holo.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Holo",
		source_other: "http://myanimelist.net/character/7373/Holo",
		fullname: "Holo Wisewolf of Yoitsu",
		align: "right"
	},
	{
		name: "Homura",
		file: "Homura.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Homura",
		source_other: "http://myanimelist.net/character/38005/Homura_Akemi",
		fullname: "Homura Akemi",
		align: "center"
	},
	{
		name: "Hyatt",
		file: "Hyatt.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Hyatt",
		source_other: "http://myanimelist.net/character/1838/Hyatt",
		fullname: "Hyatt",
		align: "right"
	},
	{
		name: "Ibara",
		file: "Ibara.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Ibara",
		source_other: "http://myanimelist.net/character/55137/Mayaka_Ibara",
		fullname: "Mayaka Ibara",
		align: "center"
	},
	{
		name: "Ika",
		file: "Ika.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Ika",
		source_other: "http://myanimelist.net/character/20512/Ika_Musume",
		fullname: "Ika Musume",
		align: "left"
	},
	{
		name: "Kagami",
		file: "Kagami.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kagami",
		source_other: "http://myanimelist.net/character/2171/Kagami_Hiiragi",
		fullname: "Kagami Hiiragi",
		align: "center"
	},
	{
		name: "Kanade",
		file: "Kanade.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kanade",
		source_other: "http://myanimelist.net/character/22369/Kanade_Tachibana",
		fullname: "Kanade Tachibana",
		align: "right"
	},
	{
		name: "Kanoe",
		file: "Kanoe.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kanoe",
		source_other: "http://myanimelist.net/character/30273/Yuuko_Kanoe",
		fullname: "Yuuko Kanoe",
		align: "right"
	},
	{
		name: "Kaori",
		file: "Kaori.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kaori",
		source_other: "http://myanimelist.net/character/2884/Kaori",
		fullname: "Kaori",
		align: "left"
	},
	{
		name: "Karen",
		file: "Karen.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Karen",
		source_other: "http://myanimelist.net/character/50223/Karen_Kujou",
		fullname: "Karen Kujou",
		align: "center"
	},
	{
		name: "Kasukabe",
		file: "Kasukabe.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kasukabe",
		source_other: "http://myanimelist.net/character/69439/You_Kasukabe",
		fullname: "You Kasukabe",
		align: "center"
	},
	{
		name: "Kate",
		file: "Kate.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kate",
		source_other: "http://myanimelist.net/character/6823/Kate",
		fullname: "Kate",
		align: "center"
	},
	{
		name: "Kirino",
		file: "Kirino.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kirino",
		source_other: "http://myanimelist.net/character/24544/Kirino_Kousaka",
		fullname: "Kirino Kousaka",
		align: "right"
	},
	{
		name: "Kirisame Marisa",
		file: "Kirisame Marisa.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kirisame_Marisa",
		source_other: "http://myanimelist.net/character/5458/Kirisame_Marisa",
		fullname: "Kirisame Marisa",
		align: "right"
	},
	{
		name: "Konata",
		file: "Konata.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Konata",
		source_other: "http://myanimelist.net/character/2169/Konata_Izumi",
		fullname: "Konata Izumi",
		align: "right"
	},
	{
		name: "Kurisu",
		file: "Kurisu.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kurisu",
		source_other: "http://myanimelist.net/character/34470/Kurisu_Makise",
		fullname: "Kurisu Makise",
		align: "center"
	},
	{
		name: "Kuroko",
		file: "Kuroko.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kuroko",
		source_other: "http://myanimelist.net/character/17017/Kuroko_Shirai",
		fullname: "Kuroko Shirai",
		align: "right"
	},
	{
		name: "Kyouka",
		file: "Kyouka.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kyouka",
		source_other: "http://myanimelist.net/character/11704/Kyouka_Midarezaki",
		fullname: "Kyouka Midarezaki",
		align: "right"
	},
	{
		name: "Kyouko Sakura",
		file: "Kyouko Sakura.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kyouko_Sakura",
		source_other: "http://myanimelist.net/character/40006/Kyouko_Sakura",
		fullname: "Kyouko Sakura",
		align: "center"
	},
	{
		name: "Kyouko Toshinou",
		file: "Kyouko Toshinou.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kyouko_Toshinou",
		source_other: "http://myanimelist.net/character/35871/Kyouko_Toshinou",
		fullname: "Kyouko Toshinou",
		align: "center"
	},
	{
		name: "Kyubey",
		file: "Kyubey.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Kyubey",
		source_other: "http://myanimelist.net/character/38566/Kyuubey",
		fullname: "Kyuubey ",
		align: "center"
	},
	{
		name: "Lain",
		file: "Lain (still).png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Lain",
		source_other: "http://myanimelist.net/character/2219/Lain_Iwakura",
		fullname: "Lain Iwakura",
		align: "center"
	},
	//{
	//	name: "Lain",
	//	file: "Lain (anim).gif",
	//	source: "http://0x40Hues.blogspot.com/Sources/Defaults#Lain",
	//	source_other: "http://myanimelist.net/character/2219/Lain_Iwakura",
	//	fullname: "Lain Iwakura",
	//	align: "left",
	//	frameDuration: 83
	//},
	{
		name: "Lala-Ru",
		file: "Lala-Ru.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Lala-Ru",
		source_other: "http://myanimelist.net/character/1664/Lala-Ru",
		fullname: "Lala-Ru",
		align: "center"
	},
	{
		name: "Lilly",
		file: "Lilly.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Lilly",
		source_other: "http://katawashoujo.wikia.com/wiki/Lilly_Satou",
		fullname: "Lilly Satou",
		align: "center"
	},
	{
		name: "Louise",
		file: "Louise.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Louiseouise",
		source_other: "http://myanimelist.net/character/136/Louise_Fran%C3%A7oise_Le_Blanc_de_La_Valli%C3%A8re",
		fullname: "Louise Françoise Le Blanc de La Vallière",
		align: "center"
	},
	{
		name: "Lucchini",
		file: "Lucchini.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Lucchini",
		source_other: "http://myanimelist.net/character/7632/Francesca_Lucchini",
		fullname: "Francesca Lucchini",
		align: "left"
	},
	{
		name: "Lucy",
		file: "Lucy.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Lucy",
		source_other: "http://myanimelist.net/character/738/Lucy",
		fullname: "Lucy ",
		align: "left"
	},
	{
		name: "Madotsuki",
		file: "Madotsuki.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Madotsuki",
		source_other: "http://myanimelist.net/character/84705/Madotsuki",
		fullname: "Madotsuki",
		align: "center"
	},
	{
		name: "Mai",
		file: "Mai.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mai",
		source_other: "http://myanimelist.net/character/10421/Mai_Minakami",
		fullname: "Mai Minakami",
		align: "right"
	},
	{
		name: "Maka",
		file: "Maka.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Maka",
		source_other: "http://myanimelist.net/character/8439/Maka_Albarn",
		fullname: "Maka Albarn",
		align: "right"
	},
	{
		name: "Makimaki",
		file: "Makimaki.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Makimaki",
		source_other: "http://myanimelist.net/character/42720/Makina_Sakamaki",
		fullname: "Makina Sakamaki",
		align: "center"
	},
	{
		name: "Makoto",
		file: "Makoto.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Makoto",
		source_other: "http://myanimelist.net/character/3987/Makoto_Kikuchi",
		fullname: "Makoto Kikuchi",
		align: "center"
	},
	{
		name: "Mami",
		file: "Mami.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mami",
		source_other: "http://myanimelist.net/character/38194/Mami_Tomoe",
		fullname: "Mami Tomoe",
		align: "right"
	},
	{
		name: "Mao",
		file: "Mao.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mao",
		source_other: "http://myanimelist.net/character/74079/Mao_Amatsuka",
		fullname: "Mao Amatsuka",
		align: "center"
	},
	{
		name: "Mary",
		file: "Mary.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mary",
		source_other: "http://ibrpg.wikia.com/wiki/Mary",
		fullname: "Mary",
		align: "right"
	},
	{
		name: "Mashiro",
		file: "Mashiro.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mashiro",
		source_other: "http://myanimelist.net/character/91971/Mashiro_Mitsumine",
		fullname: "Mashiro Mitsumine",
		align: "center"
	},
	{
		name: "Mayoi",
		file: "Mayoi.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mayoi",
		source_other: "http://myanimelist.net/character/22052/Mayoi_Hachikuji",
		fullname: "Mayoi Hachikuji",
		align: "left"
	},
	{
		name: "Mayuri",
		file: "Mayuri.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mayuri",
		source_other: "http://myanimelist.net/character/35253/Mayuri_Shiina",
		fullname: "Mayuri Shiina",
		align: "center"
	},
	{
		name: "Melfina",
		file: "Melfina.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Melfina",
		source_other: "http://myanimelist.net/character/1014/Melfina",
		fullname: "Melfina ",
		align: "left"
	},
	{
		name: "Mey-Rin",
		file: "Mey-Rin.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mey-Rin",
		source_other: "http://myanimelist.net/character/14952/Mey-Rin",
		fullname: "Mey-Rin ",
		align: "left"
	},
	{
		name: "Miho",
		file: "Miho.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Miho",
		source_other: "http://myanimelist.net/character/62939/Miho_Nishizumi",
		fullname: "Miho Nishizumi",
		align: "center"
	},
	{
		name: "Miku",
		file: "Miku.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Miku",
		source_other: "http://myanimelist.net/character/7156/Miku_Hatsune",
		fullname: "Miku Hatsune",
		align: "right"
	},
	{
		name: "Mio",
		file: "Mio.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mio",
		source_other: "http://myanimelist.net/character/19566/Mio_Akiyama",
		fullname: "Mio Akiyama",
		align: "right"
	},
	{
		name: "Mio Naganohara",
		file: "Mio Naganohara.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mio_Naganohara",
		source_other: "http://myanimelist.net/character/40081/Mio_Naganohara",
		fullname: "Mio Naganohara",
		align: "right"
	},
	{
		name: "Mirai",
		file: "Mirai.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mirai",
		source_other: "http://myanimelist.net/character/81751/Mirai_Kuriyama",
		fullname: "Mirai Kuriyama",
		align: "center"
	},
	{
		name: "Misaka",
		file: "Misaka.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Misaka",
		source_other: "http://myanimelist.net/character/13701/",
		fullname: "Mikoto Misaka",
		align: "left"
	},
	{
		name: "Misaki",
		file: "Misaki.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Misaki",
		source_other: "http://myanimelist.net/character/2552/Misaki_Nakahara",
		fullname: "Misaki Nakahara",
		align: "center"
	},
	{
		name: "Miu",
		file: "Miu.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Miu",
		source_other: "http://myanimelist.net/character/570/Miu_Matsuoka",
		fullname: "Miu Matsuoka",
		align: "center"
	},
	{
		name: "Miyako",
		file: "Miyako.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Miyako",
		source_other: "http://myanimelist.net/character/2627/Miyako",
		fullname: "Miyako ",
		align: "center"
	},
	{
		name: "Mizuki",
		file: "Mizuki.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Mizuki",
		source_other: "http://myanimelist.net/character/27363/Mizuki_Himeji",
		fullname: "Mizuki Himeji",
		align: "center"
	},
	{
		name: "Momo",
		file: "Momo.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Momo",
		source_other: "http://myanimelist.net/character/17364/Deviluke_Momo_Velia",
		fullname: "Momo Belia Deviluke",
		align: "center"
	},
	{
		name: "Monoko",
		file: "Monoko.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Monoko",
		source_other: "http://yumenikki.wikia.com/wiki/Monoko",
		fullname: "Monoko",
		align: "left"
	},
	{
		name: "Morgiana",
		file: "Morgiana.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Morgiana",
		source_other: "http://myanimelist.net/character/43121/Morgiana",
		fullname: "Morgiana",
		align: "left"
	},
	{
		name: "Motoko",
		file: "Motoko.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Motoko",
		source_other: "http://myanimelist.net/character/1795/Motoko_Kusanagi",
		fullname: "Motoko \"Major\" Kusanagi",
		align: "right"
	},
	{
		name: "Nano",
		file: "Nano.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Nano",
		source_other: "http://myanimelist.net/character/10422/Nano_Shinonome",
		fullname: "Nano Shinonome",
		align: "center"
	},
	{
		name: "Nee-san",
		file: "Nee-san.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Nee-san",
		source_other: "http://myanimelist.net/character/42719/Iroe_Genma",
		fullname: "Iroe Genma",
		align: "center"
	},
	{
		name: "Noel",
		file: "Noel.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Noel",
		source_other: "http://myanimelist.net/character/24493/No%C3%ABl_Kannagi",
		fullname: "Noël Kannagi",
		align: "center"
	},
	{
		name: "Nymph",
		file: "Nymph.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Nymph",
		source_other: "http://myanimelist.net/character/23496/Nymph",
		fullname: "Nymph",
		align: "center"
	},
	{
		name: "Onihime",
		file: "Onihime.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Onihime",
		source_other: "http://myanimelist.net/character/17245/Onizuka_Hime",
		fullname: "Hime Onihime Onizuka",
		align: "center"
	},
	{
		name: "Osaka",
		file: "Osaka.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Osaka",
		source_other: "http://myanimelist.net/character/183/Ayumu_Kasuga",
		fullname: "Ayumu Osaka Kasuga",
		align: "center"
	},
	{
		name: "Popura",
		file: "Popura.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Popura",
		source_other: "http://myanimelist.net/character/24417/Popura_Taneshima",
		fullname: "Popura Taneshima",
		align: "center"
	},
	{
		name: "Rei",
		file: "Rei.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Rei",
		source_other: "http://myanimelist.net/character/86/Rei_Ayanami",
		fullname: "Rei Ayanami",
		align: "center"
	},
	{
		name: "Renge",
		file: "Renge.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Renge",
		source_other: "http://myanimelist.net/character/54151/Renge_Miyauchi",
		fullname: "Renge Miyauchi",
		align: "center"
	},
	{
		name: "Rika",
		file: "Rika.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Rika",
		source_other: "http://myanimelist.net/character/1534/Furude_Rika",
		fullname: "Rika Furude",
		align: "left"
	},
	{
		name: "Rikka",
		file: "Rikka.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Rikka",
		source_other: "http://myanimelist.net/character/65865/Rikka_Takanashi",
		fullname: "Rikka Takanashi",
		align: "center"
	},
	{
		name: "Rin",
		file: "Rin.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Rin",
		source_other: "http://myanimelist.net/character/498/Rin_Tohsaka",
		fullname: "Rin Tohsaka",
		align: "center"
	},
	{
		name: "Rin Tezuka",
		file: "Rin Tezuka.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Rin_Tezuka",
		source_other: "http://katawashoujo.wikia.com/wiki/Rin_Tezuka",
		fullname: "Rin Tezuka",
		align: "center"
	},
	{
		name: "Ritsu",
		file: "Ritsu.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Ritsu",
		source_other: "http://myanimelist.net/character/19567/Ritsu_Tainaka",
		fullname: "Ritsu Tainaka",
		align: "center"
	},
	{
		name: "Ruri",
		file: "Ruri.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Ruri",
		source_other: "http://myanimelist.net/character/31008/Ruri_Gokou",
		fullname: "Ruri Gokou",
		align: "center"
	},
	{
		name: "Ryuuko",
		file: "Ryuuko.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Ryuuko",
		source_other: "http://myanimelist.net/character/83797/Ryuuko_Matoi",
		fullname: "Ryuuko Matoi",
		align: "right"
	},
	{
		name: "Sako",
		file: "Sako.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Sako",
		source_other: "http://myanimelist.net/character/62467/SAKO_RK95",
		fullname: "SAKO RK95",
		align: "right"
	},
	{
		name: "Sakura",
		file: "Sakura.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Sakura",
		source_other: "http://myanimelist.net/character/2671/Sakura_Kinomoto",
		fullname: "Sakura Kinomoto",
		align: "center"
	},
	{
		name: "Sakurako",
		file: "Sakurako.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Sakurako",
		source_other: "http://myanimelist.net/character/35878/Sakurako_Ohmuro",
		fullname: "Sakurako Ohmuro",
		align: "center"
	},
	{
		name: "Sanae",
		file: "Sanae.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Sanae",
		source_other: "http://myanimelist.net/character/67215/Sanae_Dekomori",
		fullname: "Sanae Dekomori",
		align: "left"
	},
	{
		name: "Senjougahara",
		file: "Senjougahara.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Senjougahara",
		source_other: "http://myanimelist.net/character/22037/Hitagi_Senjougahara",
		fullname: "Hitagi Senjougahara",
		align: "right"
	},
	{
		name: "Shiina",
		file: "Shiina.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Shiina",
		source_other: "http://myanimelist.net/character/61371/Shiina_Mashiro",
		fullname: "Mashiro Shiina",
		align: "center"
	},
	{
		name: "Shinobu",
		file: "Shinobu.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Shinobu",
		source_other: "http://myanimelist.net/character/23602/Shinobu_Oshino",
		fullname: "Shinobu Oshino",
		align: "center"
	},
	{
		name: "Sonya",
		file: "Sonya.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Sonya",
		source_other: "http://myanimelist.net/character/32769/Sonya",
		fullname: "Sonya",
		align: "center"
	},
	{
		name: "Stocking",
		file: "Stocking.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Stocking",
		source_other: "http://myanimelist.net/character/32801/Stocking_Anarchy",
		fullname: "Stocking Anarchy",
		align: "center"
	},
	{
		name: "Suiseiseki",
		file: "Suiseiseki.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Suiseiseki",
		source_other: "http://myanimelist.net/character/1105/Suiseiseki",
		fullname: "Suiseiseki",
		align: "left"
	},
	{
		name: "Taiga",
		file: "Taiga.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Taiga",
		source_other: "http://myanimelist.net/character/12064/Taiga_Aisaka",
		fullname: "Taiga Aisaka",
		align: "center"
	},
	{
		name: "Tomoko",
		file: "Tomoko.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Tomoko",
		source_other: "http://myanimelist.net/character/50057/Tomoko_Kuroki",
		fullname: "Tomoko Kuroki",
		align: "center"
	},
	{
		name: "Tsumiki",
		file: "Tsumiki.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Tsumiki",
		source_other: "http://myanimelist.net/character/55839/Tsumiki_Miniwa",
		fullname: "Tsumiki Miniwa",
		align: "center"
	},
	{
		name: "Urotsuki",
		file: "Urotsuki.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Urotsuki",
		source_other: "http://yume2kki.wikia.com/wiki/Urotsuki",
		fullname: "Urotsuki",
		align: "center"
	},
	{
		name: "Winry",
		file: "Winry.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Winry",
		source_other: "http://myanimelist.net/character/63/Winry_Rockbell",
		fullname: "Winry Rockbell",
		align: "right"
	},
	{
		name: "Yasuna",
		file: "Yasuna.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Yasuna",
		source_other: "http://myanimelist.net/character/33584/Yasuna_Oribe",
		fullname: "Yasuna Oribe",
		align: "left"
	},
	{
		name: "Yin",
		file: "Yin.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Yin",
		source_other: "http://myanimelist.net/character/2163/Yin",
		fullname: "Yin",
		align: "center"
	},
	{
		name: "Yoko",
		file: "Yoko.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Yoko",
		source_other: "http://myanimelist.net/character/2063/Yoko_Littner",
		fullname: "Yoko Littner",
		align: "center"
	},
	{
		name: "Yotsuba",
		file: "Yotsuba.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Yotsuba",
		source_other: "http://myanimelist.net/character/3568/Yotsuba_Koiwai",
		fullname: "Yotsuba Koiwai",
		align: "center"
	},
	{
		name: "Yui",
		file: "Yui.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Yui",
		source_other: "http://myanimelist.net/character/19565/Yui_Hirasawa",
		fullname: "Yui Hirasawa",
		align: "center"
	},
	{
		name: "Yukari",
		file: "Yukari.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Yukari",
		source_other: "http://myanimelist.net/character/76236/Yukari_Hinata",
		fullname: "Yukari Hinata",
		align: "center"
	},
	{
		name: "Yuki",
		file: "Yuki.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Yuki",
		source_other: "http://myanimelist.net/character/249/Yuki_Nagato",
		fullname: "Yuki Nagato",
		align: "center"
	},
	{
		name: "Yuno",
		file: "Yuno.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Yuno",
		source_other: "http://myanimelist.net/character/4963/Gasai_Yuno",
		fullname: "Yuno Gasai",
		align: "center"
	},
	{
		name: "Yunocchi",
		file: "Yunocchi.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Yunocchi",
		source_other: "http://myanimelist.net/character/2528/Yuno",
		fullname: "Yuno",
		align: "center"
	},
	{
		name: "Yuuko",
		file: "Yuuko.png",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#Yuuko",
		source_other: "http://myanimelist.net/character/10418/Yuuko_Aioi",
		fullname: "Yuuko Aioi",
		align: "center"
	}
];

var madeonPreload = {
    file: "songs/prebuild_Finale.mp3",
    buildUp: "songs/preprebuild_Finale.mp3"
}

var rgSongs = [
	// Pack: Default HQ
	{
		pack: 1,
		file: "songs/loop_Finale.mp3",
		name: "Madeon - Finale",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_Finale",
		rhythm: "x..xo...x...o...x..xo...x...o...x..xo...x...o...x..xo...x...oxoox..xo...x...o...x..xo...x...o...x..xo...x...o...x...o...x...oooo",
		buildUp: "songs/build_Finale.mp3"
	},
	{
		pack: 1,
		file: "songs/loop_Radioactive.mp3",
		name: "Imagine Dragons - Radioactive",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_Radioactive",
		rhythm: "o...x.o.o...x.o.o...x...o...x.o.o...x.o.o...x.......x.......x...",
	},
	{
		pack: 1,
		file: "songs/loop_RowRow.mp3",
		name: "Row Row Fight the Powah (RAGEFOXX & SLUTTT MIX)",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_RowRow",
		rhythm: "o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...xxx.x...x...o...x...o...x...o...x...o...x...o...x...o...o...o...o..."
	},
	{
		pack: 1,
		file: "songs/loop_Desire.mp3",
		name: "Outlaw Star OST - Desire",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_Desire",
		rhythm: "o...x...o.o.x.x...o.x...o.o.x...o...x...o.o.x.x...o.x...oo..x.x.o...x...o.o.x.x...o.x...oo..x.x.o...x...o.o.x.x...o.x...x...x.xx",
		buildUp: "songs/build_Desire.mp3",
		buildUpRhythm: "x.....x.x.x.xxx."
	},
	{
		pack: 1,
		file: "songs/loop_OutOfSight.mp3",
		name: "The Bloody Beetroots - Out of Sight",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_OutOfSight",
		rhythm: "o.....oox.......o.o....ox.......o.....oox...o...o.o....ox.......o......ox.......o.o....ox.......o.....oox...o...o.o.....+......."
	},
	{
		pack: 1,
		file: "songs/loop_SmileWithoutAFace.mp3",
		name: "Buckethead - Smile Without a Face",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_SmileWithoutAFace",
		rhythm: "o......ox.....o.o.......x.......o......ox.....o.o.....o.x.ooooooo......ox.....o.o.......x.......o......ox.....o.o.....o.x.oooooo",
		buildUp: "songs/build_SmileWithoutAFace.mp3",
		buildUpRhythm: "..o.....-:x.......o.....-:x.......o.....-:x.......o.....-:x.......o.....-:x.......o.....-:x.x....."
	},
	{
		pack: 1,
		file: "songs/loop_CourtshipDate.mp3",
		name: "Crystal Castles - Courtship Dating",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_CourtshipDate",
		rhythm: "o...x.....o.x...o...x.....o.x...o...x.....o.x...o...x.....o.+..."
	},
	{
		pack: 1,
		file: "songs/loop_Vordhosbn.mp3",
		name: "Aphex Twin - Vordhosbn",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_Vordhosbn",
		rhythm: "o...x..---o.x...-.o.x------.x..-o.-.x.o..-.ox-.-----x-o-------o-o...x..---o.x...-.o.x------.x..-o.-.x.o..-.ox-.-----x-o-------o-o...x..---o.x...-.o.x------.x..-o.-.x.o..-.ox-.-----x-o-------o-o...x..---o.x...-.o.x------.x..-o.-.x.o..-.ox-.-----x-o-------o-o...x..---o.x...-.o.x------.x..-o.-.x.o..-.ox-.-----x-o-------o-o...x..---o.x...-.o.x------.x..-o.-.x.o..-.ox-.-----x-o-------o-",
		buildUp: "songs/build_Vordhosbn.mp3",
		buildUpRhythm: ":...x..------.......-.-----.+...............x..-.-.--.-.-.-.---."
	},
	{
		pack: 1,
		file: "songs/loop_Orange.mp3",
		name: "Culprate - Orange Sunrise, Sunset",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_Orange",
		rhythm: "o.o.x..o.x.x....o..ox......x....o...x....o.x....o...x....o.xx...o.o.x..o.x.x....o..ox......x....o...x....o.x...xo...x....o.xx..."
	},
	{
		pack: 1,
		file: "songs/loop_Spoiler.mp3",
		name: "Hyper - Spoiler",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_Spoiler",
		rhythm: "o+......x+......o+......x+......o+......x+......o+......x+......o+......x+......o+......x+......o+......x+......o+..............o+......x+......o+......x+......o+......x+......o+......x+......o+......x+......o+......x+......o---------------o+......x......."
	},
	{
		pack: 1,
		file: "songs/loop_Kryptonite.mp3",
		name: "DJ Fresh - Kryptonite",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_Kryptonite",
		rhythm: "o.x..ox.o.x..ox.o.x..ox.o.x..ox.o.x..xx.o.x..xx.o.x..xx.o.x..xx.o.x..ox.o.x..ox.o.x..ox.o.x..ox.o.x..xx.o.x..xx.o.xx.xx.o.x..xx."
	},
	{
		pack: 1,
		file: "songs/loop_BeyondRightNow.mp3",
		name: "STS9 - Beyond Right Now (Glitch Mob Remix)",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_BeyondRightNow",
		rhythm: "o.......x...o.......o...xxxxx...o.o.....x...o.......o...xxxxx...o.......x...o.......o...xxxxx...o.......x...o...o.......+.......o.......x...o.......o...xxxxx...o.o.....x...o...-.-.o.-.xxx+x+x+o.......x...o.......o...xxxxx...o.......x...o...o...o.o.+......."
	},
	{
		pack: 1,
		file: "songs/loop_HoldMyLiquor.mp3",
		name: "Kanye West - Hold My Liquor",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_HoldMyLiquor",
		rhythm: "o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...............+..."
	},
	{
		pack: 1,
		file: "songs/loop_Heart.mp3",
		name: "Savant - Heart",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_Heart",
		rhythm: "o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x.-.o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...xx-.",
		buildUp: "songs/build_Heart.mp3",
		buildUpRhythm: "o...."
	},
	{
		pack: 1,
		file: "songs/loop_FuturePeople.mp3",
		name: "SynSUN - Future People (Sonic Elysium Remix)",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_FuturePeople",
		rhythm: "o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o---o---o-------o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...:.:.:.:.:.:.:.+.....x+..x+..x+.."
	},
	{
		pack: 1,
		file: "songs/loop_Nanox.mp3",
		name: "Singularity - Nanox",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_Nanox",
		rhythm: "o.....o.x...o.......o...x.......o.....o.x...o.......o...x.......|x|x|x|.x...|x|x|x|xo...x.......|x|x|x|.x...|x|x|x|xo...x.......o.....o.x...o.......o...x.......o.....o.x...o.......o...x.......|x|x|x|.x...|x|x|x|xo...x.......|x|x|x|.x...|x|x|x|xo...x......."
	},
	{
		pack: 1,
		file: "songs/loop_BlackEarth.mp3",
		name: "Dayseeker - Black Earth",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_BlackEarth2",
		rhythm: "--------o.....o.....o...+...............................x.......x.x.x.x.o.....o.....o...+...........................x...x.......--------o.....o.....o...+...............................x.......x.x.x.x.o.....o.....o...+...........................x...x......."
	},
	{
		pack: 1,
		file: "songs/loop_EarlyMorningMay.mp3",
		name: "Ronald Jenkees - Early Morning May",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_EarlyMorningMay",
		rhythm: "o.......x.......o.......x.....o.o.......o.......o...o...o...o...o.......x.......o.......x.....o.o.......x.......o.......x.....o."
	},
	{
		pack: 1,
		file: "songs/loop_Weapon.mp3",
		name: "deadmau5 - Raise Your Weapon (Madeon Remix)",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_Weapon",
		rhythm: "o.-.x...o...x...o.-.x...o...x...o.-.x...o...x...o.-.x...o...x...o.-.x...o...x...o.-.x...o...x...o..o..o...o...o.............x...",
		buildUp: "songs/build_Weapon.mp3",
		buildUpRhythm: "----"
	},
	{
		pack: 1,
		file: "songs/loop_LoveOnHaightStreet.mp3",
		name: "BT - Love On Haight Street ",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_LoveOnHaightStreet",
		rhythm: "o.....x.........o.ox....oo..o...x....o...o..x......o..o..x...o.....o..x....oo..o...x....+...o+..x.+...x..o.ox.....o..o...x.....oo..o..x.....o.o.o..x..oooo......x..o.....o..x.....oo..o..x.....o..oo..x............x.......oo.ox.....oo..o..x.....o...+.........",
		buildUp: "songs/build_LoveOnHaightStreet.mp3",
		buildUpRhythm: "x......:......:.....:......:.....:.....:......:....."
	},
	{
		pack: 1,
		file: "songs/loop_TheClockmaker.mp3",
		name: "Vexare - The Clockmaker",
		source: "http://0x40Hues.blogspot.com/Sources/Defaults#loop_TheClockmaker",
		rhythm: "o.......-...+...x...-----...-...o..:..:.o....:..x.......o...-...o...........o...x.....x.....x...o...............+...............o.......----o--.x.......-...-...o..:..:.o....:..x.......o.-.-.-.o...........o...x...............o.......o.......x...............:...:...:...:.+.x...-----...-...o..:..:.o....:..x.......o...-...o...........o...x.....x.....x...o...............+...............o...........----x.....-.-...-...o..:..:.o....:..x.......o.-.-.-.o...........o...x...............o.......o.......x.....x.....-...",
		buildUp: "songs/build_TheClockmaker.mp3",
		buildUpRhythm: "+...."
	},
	// Pack: Hues Mix A
	{
		pack: 2,
		file: "songs/loop_Omen.mp3",
		name: "The Prodigy - Omen",
		source: "http://www.youtube.com/watch?v=zsV9wbTFvDE",
		rhythm: "x.x.o...x.o.....x...o...x.o....ox...o...x.o.....x...o.o.x.o.oooox.o.o...x.o.....x...o...x.o....ox...o...x.o.....x...o.o.x.o.xxox.xxxo...x.o.....x...o...x.o....ox...o...x.o.....x...o.o.x.o.oooox.o.o...x.o.....x...o...x.o....ox...o...x.o.....x...o.o.x.o.xxoox...o...x..oxxo.x.o.o...x..oxxo.x.x.o..ox.o....ox...o.o.x.o.----x.-.o...x..oxxo.x.o.o...x..oxxo.x.x.o..ox.o....ox...o..o..o.oooo",
		buildUp: "songs/build_Omen.mp3",
		buildUpRhythm: ":.:.:....:.:+...o...x.o.....x...o.o.x.o...x."
	},
	{
		pack: 2,
		file: "songs/loop_FromMyEyes.mp3",
		name: "Phetsta - From My Eyes",
		source: "http://www.youtube.com/watch?v=-paV56tKayw",
		rhythm: "o...x.....o.x...o...x.....o.x...o...x.....o.x...o...x.....o.x...o...x.....o.x...o...x.....o.x...o...x.....o.x...o...x...xxo.x...o...x.....o.x...o...x.....o.x...o...x.....o.x...o...x.....o.x...o...x.....o.x...o...x.....o.x...o...o...o...o...o---o-------x+.."
	},
	{
		pack: 2,
		file: "songs/loop_BlackPanther.mp3",
		name: "Crystal Castles - Black Panther",
		source: "http://www.youtube.com/watch?v=zQXHAPf5ijQ",
		rhythm: "o.:.x.::o.:.x.::o.:.x.::o.:.x.:.o.:.x.::o.:.x.::o.:.x.::o.:.x.:.o.:.x.::o.:.x.::o.:.x.::o.:.x.:.o.:.x.::o.:.x.::o.:.x.::o.:.x.:."
	},
	{
		pack: 2,
		file: "songs/loop_RunAway.mp3",
		name: "Submatik - Run Away",
		source: "http://www.youtube.com/watch?v=dxztDhrrXaY",
		rhythm: "o...x.o.....x...o...x.....o.x.o.o...x.....o.x...o...x.....o.x...o...x.....o.x...o...x.....o.x.o.o...x.....o.x...o...x.....o.x...o...x.....o.x...o...x.....o.x.o.o...x.....o.x...o...x.....o.x...o...x.o...o.x.....o.x.....o.x.o.o...x.....o.x.....o.x.....o.x.x."
	},
	{
		pack: 2,
		file: "songs/loop_Chansond'Automne.mp3",
		name: "Chris Christodoulou - Chanson d'Automne",
		source: "http://www.youtube.com/watch?v=iSnOWqTPUNQ",
		rhythm: "o.......x.....o.....o...x.......o.....o.x.....o.....o...x.o-----o.o.o.o.x.....o.....o...x.......o.o...oox...o.....xxo...xoo.o.x.",
	},
	{
		pack: 2,
		file: "songs/loop_Moan.mp3",
		name: "Trentemoller - Moan",
		source: "http://www.youtube.com/watch?v=_LuYdnPy8tA",
		rhythm: "o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o......+o.......o...o...o...o...o...o...o...o...o...o...o...o...o...o...o......."
	},
	{
		pack: 2,
		file: "songs/loop_ClearMayhem.mp3",
		name: "Faskil - Clear Mayhem (Grid Systems Carte Blanche Remix)",
		source: "https://www.youtube.com/watch?v=A7ZQ6ZBdDJQ",
		rhythm: "o...o...o...o...o...o...o...o...+...............o...x...o...o.x.o...x.:.o...x...o...x...o...o.x.o...x.:.o...x.x.o...x...o...o.x.o...x.:.o...x...o...x...o...o.x.o...x.:.o...x.x.o...x...o...o.x.o...x.:.o...x...o...x...o...o.x.o...x.:.o...x.x.o...x...o...o.x."
	},
	{
		pack: 2,
		file: "songs/loop_Duvet.mp3",
		name: "Boa - Duvet",
		source: "https://www.youtube.com/watch?v=4-PkAQcuZOw",
		rhythm: "o......o.oo.....o......o.oo.....o......o.oo.....x......o.oo.....",
	},
	{
		pack: 2,
		file: "songs/loop_MoneyTrees.mp3",
		name: "Kendrick Lamar - Money Trees",
		source: "https://www.youtube.com/watch?v=whyRZ1zzIRM",
		rhythm: "x..o..o.x...o...x..o..o.x...o...x.o.....x...o..ox..o.xo.x...o...x..o..o.x...o...x..o..o.x...o...x.o.....x...o..ox..o.xo.x...o...",
	},
	{
		pack: 2,
		file: "songs/loop_Timeless.mp3",
		name: "PrototypeRaptor - Timeless",
		source: "https://www.youtube.com/watch?v=IPriPTbCf88",
		rhythm: "o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...xoo.o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x...o...x..."
	},
	{
		pack: 2,
		file: "songs/loop_Intimate.mp3",
		name: "Crystal Castles - Intimate",
		source: "https://www.youtube.com/watch?v=FBsEoOM3dkU",
		rhythm: "o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:.o.:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:...:.x.:."
	},
	{
		pack: 2,
		file: "songs/loop_Vibrate(reversed).mp3",
		name: "Outkast - Vibrate (reversed)",
		source: "https://www.youtube.com/watch?v=R_toHjogc_s",
		rhythm: "o..ox.o.o..ox.o.o..oxxo.o..ox.o.o..ox.o.o..ox.o.o..oxxo.o..ox.o.",
	},
	{
		pack: 2,
		file: "songs/loop_MissYou.mp3",
		name: "Nhato - Miss You",
		source: "https://www.youtube.com/watch?v=bZQAuaeCtiM",
		rhythm: "o.+.o...o...o...o...o...o...o...o.:.o.:.o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o...o.+.o...o...........+...o...o...o...o...o...o...o...o...o.-.-.-.........o..o..o...x...o.............+...o...o...o...o...o...o...o...o.o.o.+.............",
		buildUp: "songs/build_MissYou.mp3",
		buildUpRhythm: "::::::::::::"
	},
	{
		pack: 2,
		file: "songs/loop_PropaneNightmares.mp3",
		name: "Pendulum - Propane Nightmares",
		source: "https://www.youtube.com/watch?v=y2j5uMYTnDE",
		rhythm: "o.x..ox.o.x..ox.o.x..ox.o.x..xx.o.x..ox.o.x..ox.o.x..ox.o.x..xx.o.x..ox.o.x..ox.o.x..ox.o.x..xx.o.x..ox.o.x..ox.o.x..ox..x..x.x.o.x..ox.o.x..ox.o.x..ox.o.x..xx.o.x..ox.o.x..ox.o.x..ox.o.x..xx.o.x..ox.o.x..ox.o.x..ox.o.x..xx.o.x..ox.o.x..ox.o.xxxxxxxxxxxxxxo..ox..oo.oox...o..ox..oo.oox.xxo..ox..oo.oox...o..ox..oo.oox.xxo..ox..oo.oox...o..ox..oo.oox.xxo..ox..oo.oox...o..ox..o.xoox.o."
	},
	{
		pack: 3,
		file: "songs/loop_Sail.mp3",
		name: "AWOLNation - Sail",
		rhythm: "x..::.+.x...+...x..::.+.x:.:+...x..::.+.x...+...x..::.+.x::::...",
        buildUp: "songs/build_Sail.mp3",
		buildUpRhythm: ".....+...........o...+..........o:...+...........o...+...o...+.o.:..."
	},
];

var nCurrentColor = 63; // start white
var nCurrentWaifu = 0;

var nColorX, nColorY, nColorZ;


function GetRandomWaifu()
{
    var tmp = Math.round((Math.random() * (waifus.length - 1)));
    if(tmp == nCurrentWaifu) {
        return GetRandomWaifu();
    }
    nCurrentWaifu = tmp;
    return waifus[tmp];
}
           
function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function rgbToHex(rgb) {
    var ret = '#'
    for(var i=0; i < rgb.length; i++) {
        ret += pad(rgb[i].toString(16), 2);
    }
    return ret;
}

function RequestNextColor()
{
    var rgb = new Array;
    var tmp = (nCurrentColor + Math.round( (Math.random() * (colors.length - 2) ) ) + 1) % colors.length;
    if(tmp == nCurrentColor) {
        return RequestNextColor();
    }
	nCurrentColor = tmp;

	nColorX = nCurrentColor % 4;
	nColorY = parseInt(nCurrentColor / 4) % 4;
	nColorZ = parseInt(nCurrentColor / 16);
    
    rgb[0] = nColorX * 0x55;
    rgb[1] = nColorY * 0x55;
    rgb[2] = nColorZ * 0x55;

	return rgbToHex(rgb);
}