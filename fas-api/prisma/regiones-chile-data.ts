// Generado a partir de 'Códigos Únicos Territoriales, vigentes a partir del 6 de
// septiembre de 2018' — Ministerio del Interior, Subsecretaría de Desarrollo
// Regional y Administrativo (SUBDERE). 16 regiones, 56 provincias, 346 comunas.
// codigo de Región: abreviación romana estándar (I..XII, XIV..XVI, RM).
// codigo de Provincia/Comuna: Código Único Territorial (INE), sin ceros a la izquierda quitados.

export interface ComunaSeed {
  codigo: string
  descripcion: string
}

export interface ProvinciaSeed {
  codigo: string
  descripcion: string
  comunas: ComunaSeed[]
}

export interface RegionSeed {
  codigo: string
  descripcion: string
  provincias: ProvinciaSeed[]
}

export const REGIONES_CHILE: RegionSeed[] = [
  { codigo: 'I', descripcion: 'Tarapacá', provincias: [
    { codigo: '011', descripcion: 'Iquique', comunas: [{ codigo: '01101', descripcion: 'Iquique' }, { codigo: '01107', descripcion: 'Alto Hospicio' }] },
    { codigo: '014', descripcion: 'Tamarugal', comunas: [{ codigo: '01401', descripcion: 'Pozo Almonte' }, { codigo: '01402', descripcion: 'Camiña' }, { codigo: '01403', descripcion: 'Colchane' }, { codigo: '01404', descripcion: 'Huara' }, { codigo: '01405', descripcion: 'Pica' }] },
  ] },
  { codigo: 'II', descripcion: 'Antofagasta', provincias: [
    { codigo: '021', descripcion: 'Antofagasta', comunas: [{ codigo: '02101', descripcion: 'Antofagasta' }, { codigo: '02102', descripcion: 'Mejillones' }, { codigo: '02103', descripcion: 'Sierra Gorda' }, { codigo: '02104', descripcion: 'Taltal' }] },
    { codigo: '022', descripcion: 'El Loa', comunas: [{ codigo: '02201', descripcion: 'Calama' }, { codigo: '02202', descripcion: 'Ollagüe' }, { codigo: '02203', descripcion: 'San Pedro de Atacama' }] },
    { codigo: '023', descripcion: 'Tocopilla', comunas: [{ codigo: '02301', descripcion: 'Tocopilla' }, { codigo: '02302', descripcion: 'María Elena' }] },
  ] },
  { codigo: 'III', descripcion: 'Atacama', provincias: [
    { codigo: '031', descripcion: 'Copiapó', comunas: [{ codigo: '03101', descripcion: 'Copiapó' }, { codigo: '03102', descripcion: 'Caldera' }, { codigo: '03103', descripcion: 'Tierra Amarilla' }] },
    { codigo: '032', descripcion: 'Chañaral', comunas: [{ codigo: '03201', descripcion: 'Chañaral' }, { codigo: '03202', descripcion: 'Diego de Almagro' }] },
    { codigo: '033', descripcion: 'Huasco', comunas: [{ codigo: '03301', descripcion: 'Vallenar' }, { codigo: '03302', descripcion: 'Alto del Carmen' }, { codigo: '03303', descripcion: 'Freirina' }, { codigo: '03304', descripcion: 'Huasco' }] },
  ] },
  { codigo: 'IV', descripcion: 'Coquimbo', provincias: [
    { codigo: '041', descripcion: 'Elqui', comunas: [{ codigo: '04101', descripcion: 'La Serena' }, { codigo: '04102', descripcion: 'Coquimbo' }, { codigo: '04103', descripcion: 'Andacollo' }, { codigo: '04104', descripcion: 'La Higuera' }, { codigo: '04105', descripcion: 'Paiguano' }, { codigo: '04106', descripcion: 'Vicuña' }] },
    { codigo: '042', descripcion: 'Choapa', comunas: [{ codigo: '04201', descripcion: 'Illapel' }, { codigo: '04202', descripcion: 'Canela' }, { codigo: '04203', descripcion: 'Los Vilos' }, { codigo: '04204', descripcion: 'Salamanca' }] },
    { codigo: '043', descripcion: 'Limarí', comunas: [{ codigo: '04301', descripcion: 'Ovalle' }, { codigo: '04302', descripcion: 'Combarbalá' }, { codigo: '04303', descripcion: 'Monte Patria' }, { codigo: '04304', descripcion: 'Punitaqui' }, { codigo: '04305', descripcion: 'Río Hurtado' }] },
  ] },
  { codigo: 'V', descripcion: 'Valparaíso', provincias: [
    { codigo: '051', descripcion: 'Valparaíso', comunas: [{ codigo: '05101', descripcion: 'Valparaíso' }, { codigo: '05102', descripcion: 'Casablanca' }, { codigo: '05103', descripcion: 'Concón' }, { codigo: '05104', descripcion: 'Juan Fernández' }, { codigo: '05105', descripcion: 'Puchuncaví' }, { codigo: '05107', descripcion: 'Quintero' }, { codigo: '05109', descripcion: 'Viña del Mar' }] },
    { codigo: '052', descripcion: 'Isla de Pascua', comunas: [{ codigo: '05201', descripcion: 'Isla de Pascua' }] },
    { codigo: '053', descripcion: 'Los Andes', comunas: [{ codigo: '05301', descripcion: 'Los Andes' }, { codigo: '05302', descripcion: 'Calle Larga' }, { codigo: '05303', descripcion: 'Rinconada' }, { codigo: '05304', descripcion: 'San Esteban' }] },
    { codigo: '054', descripcion: 'Petorca', comunas: [{ codigo: '05401', descripcion: 'La Ligua' }, { codigo: '05402', descripcion: 'Cabildo' }, { codigo: '05403', descripcion: 'Papudo' }, { codigo: '05404', descripcion: 'Petorca' }, { codigo: '05405', descripcion: 'Zapallar' }] },
    { codigo: '055', descripcion: 'Quillota', comunas: [{ codigo: '05501', descripcion: 'Quillota' }, { codigo: '05502', descripcion: 'Calera' }, { codigo: '05503', descripcion: 'Hijuelas' }, { codigo: '05504', descripcion: 'La Cruz' }, { codigo: '05506', descripcion: 'Nogales' }] },
    { codigo: '056', descripcion: 'San Antonio', comunas: [{ codigo: '05601', descripcion: 'San Antonio' }, { codigo: '05602', descripcion: 'Algarrobo' }, { codigo: '05603', descripcion: 'Cartagena' }, { codigo: '05604', descripcion: 'El Quisco' }, { codigo: '05605', descripcion: 'El Tabo' }, { codigo: '05606', descripcion: 'Santo Domingo' }] },
    { codigo: '057', descripcion: 'San Felipe de Aconcagua', comunas: [{ codigo: '05701', descripcion: 'San Felipe' }, { codigo: '05702', descripcion: 'Catemu' }, { codigo: '05703', descripcion: 'Llaillay' }, { codigo: '05704', descripcion: 'Panquehue' }, { codigo: '05705', descripcion: 'Putaendo' }, { codigo: '05706', descripcion: 'Santa María' }] },
    { codigo: '058', descripcion: 'Marga Marga', comunas: [{ codigo: '05801', descripcion: 'Quilpué' }, { codigo: '05802', descripcion: 'Limache' }, { codigo: '05803', descripcion: 'Olmué' }, { codigo: '05804', descripcion: 'Villa Alemana' }] },
  ] },
  { codigo: 'VI', descripcion: 'Libertador General Bernardo O\'Higgins', provincias: [
    { codigo: '061', descripcion: 'Cachapoal', comunas: [{ codigo: '06101', descripcion: 'Rancagua' }, { codigo: '06102', descripcion: 'Codegua' }, { codigo: '06103', descripcion: 'Coinco' }, { codigo: '06104', descripcion: 'Coltauco' }, { codigo: '06105', descripcion: 'Doñihue' }, { codigo: '06106', descripcion: 'Graneros' }, { codigo: '06107', descripcion: 'Las Cabras' }, { codigo: '06108', descripcion: 'Machalí' }, { codigo: '06109', descripcion: 'Malloa' }, { codigo: '06110', descripcion: 'Mostazal' }, { codigo: '06111', descripcion: 'Olivar' }, { codigo: '06112', descripcion: 'Peumo' }, { codigo: '06113', descripcion: 'Pichidegua' }, { codigo: '06114', descripcion: 'Quinta de Tilcoco' }, { codigo: '06115', descripcion: 'Rengo' }, { codigo: '06116', descripcion: 'Requínoa' }, { codigo: '06117', descripcion: 'San Vicente' }] },
    { codigo: '062', descripcion: 'Cardenal Caro', comunas: [{ codigo: '06201', descripcion: 'Pichilemu' }, { codigo: '06202', descripcion: 'La Estrella' }, { codigo: '06203', descripcion: 'Litueche' }, { codigo: '06204', descripcion: 'Marchihue' }, { codigo: '06205', descripcion: 'Navidad' }, { codigo: '06206', descripcion: 'Paredones' }] },
    { codigo: '063', descripcion: 'Colchagua', comunas: [{ codigo: '06301', descripcion: 'San Fernando' }, { codigo: '06302', descripcion: 'Chépica' }, { codigo: '06303', descripcion: 'Chimbarongo' }, { codigo: '06304', descripcion: 'Lolol' }, { codigo: '06305', descripcion: 'Nancagua' }, { codigo: '06306', descripcion: 'Palmilla' }, { codigo: '06307', descripcion: 'Peralillo' }, { codigo: '06308', descripcion: 'Placilla' }, { codigo: '06309', descripcion: 'Pumanque' }, { codigo: '06310', descripcion: 'Santa Cruz' }] },
  ] },
  { codigo: 'VII', descripcion: 'Maule', provincias: [
    { codigo: '071', descripcion: 'Talca', comunas: [{ codigo: '07101', descripcion: 'Talca' }, { codigo: '07102', descripcion: 'Constitución' }, { codigo: '07103', descripcion: 'Curepto' }, { codigo: '07104', descripcion: 'Empedrado' }, { codigo: '07105', descripcion: 'Maule' }, { codigo: '07106', descripcion: 'Pelarco' }, { codigo: '07107', descripcion: 'Pencahue' }, { codigo: '07108', descripcion: 'Río Claro' }, { codigo: '07109', descripcion: 'San Clemente' }, { codigo: '07110', descripcion: 'San Rafael' }] },
    { codigo: '072', descripcion: 'Cauquenes', comunas: [{ codigo: '07201', descripcion: 'Cauquenes' }, { codigo: '07202', descripcion: 'Chanco' }, { codigo: '07203', descripcion: 'Pelluhue' }] },
    { codigo: '073', descripcion: 'Curicó', comunas: [{ codigo: '07301', descripcion: 'Curicó' }, { codigo: '07302', descripcion: 'Hualañé' }, { codigo: '07303', descripcion: 'Licantén' }, { codigo: '07304', descripcion: 'Molina' }, { codigo: '07305', descripcion: 'Rauco' }, { codigo: '07306', descripcion: 'Romeral' }, { codigo: '07307', descripcion: 'Sagrada Familia' }, { codigo: '07308', descripcion: 'Teno' }, { codigo: '07309', descripcion: 'Vichuquén' }] },
    { codigo: '074', descripcion: 'Linares', comunas: [{ codigo: '07401', descripcion: 'Linares' }, { codigo: '07402', descripcion: 'Colbún' }, { codigo: '07403', descripcion: 'Longaví' }, { codigo: '07404', descripcion: 'Parral' }, { codigo: '07405', descripcion: 'Retiro' }, { codigo: '07406', descripcion: 'San Javier' }, { codigo: '07407', descripcion: 'Villa Alegre' }, { codigo: '07408', descripcion: 'Yerbas Buenas' }] },
  ] },
  { codigo: 'VIII', descripcion: 'Biobío', provincias: [
    { codigo: '081', descripcion: 'Concepción', comunas: [{ codigo: '08101', descripcion: 'Concepción' }, { codigo: '08102', descripcion: 'Coronel' }, { codigo: '08103', descripcion: 'Chiguayante' }, { codigo: '08104', descripcion: 'Florida' }, { codigo: '08105', descripcion: 'Hualqui' }, { codigo: '08106', descripcion: 'Lota' }, { codigo: '08107', descripcion: 'Penco' }, { codigo: '08108', descripcion: 'San Pedro de la Paz' }, { codigo: '08109', descripcion: 'Santa Juana' }, { codigo: '08110', descripcion: 'Talcahuano' }, { codigo: '08111', descripcion: 'Tomé' }, { codigo: '08112', descripcion: 'Hualpén' }] },
    { codigo: '082', descripcion: 'Arauco', comunas: [{ codigo: '08201', descripcion: 'Lebu' }, { codigo: '08202', descripcion: 'Arauco' }, { codigo: '08203', descripcion: 'Cañete' }, { codigo: '08204', descripcion: 'Contulmo' }, { codigo: '08205', descripcion: 'Curanilahue' }, { codigo: '08206', descripcion: 'Los Álamos' }, { codigo: '08207', descripcion: 'Tirúa' }] },
    { codigo: '083', descripcion: 'Biobío', comunas: [{ codigo: '08301', descripcion: 'Los Ángeles' }, { codigo: '08302', descripcion: 'Antuco' }, { codigo: '08303', descripcion: 'Cabrero' }, { codigo: '08304', descripcion: 'Laja' }, { codigo: '08305', descripcion: 'Mulchén' }, { codigo: '08306', descripcion: 'Nacimiento' }, { codigo: '08307', descripcion: 'Negrete' }, { codigo: '08308', descripcion: 'Quilaco' }, { codigo: '08309', descripcion: 'Quilleco' }, { codigo: '08310', descripcion: 'San Rosendo' }, { codigo: '08311', descripcion: 'Santa Bárbara' }, { codigo: '08312', descripcion: 'Tucapel' }, { codigo: '08313', descripcion: 'Yumbel' }, { codigo: '08314', descripcion: 'Alto Biobío' }] },
  ] },
  { codigo: 'IX', descripcion: 'La Araucanía', provincias: [
    { codigo: '091', descripcion: 'Cautín', comunas: [{ codigo: '09101', descripcion: 'Temuco' }, { codigo: '09102', descripcion: 'Carahue' }, { codigo: '09103', descripcion: 'Cunco' }, { codigo: '09104', descripcion: 'Curarrehue' }, { codigo: '09105', descripcion: 'Freire' }, { codigo: '09106', descripcion: 'Galvarino' }, { codigo: '09107', descripcion: 'Gorbea' }, { codigo: '09108', descripcion: 'Lautaro' }, { codigo: '09109', descripcion: 'Loncoche' }, { codigo: '09110', descripcion: 'Melipeuco' }, { codigo: '09111', descripcion: 'Nueva Imperial' }, { codigo: '09112', descripcion: 'Padre Las Casas' }, { codigo: '09113', descripcion: 'Perquenco' }, { codigo: '09114', descripcion: 'Pitrufquén' }, { codigo: '09115', descripcion: 'Pucón' }, { codigo: '09116', descripcion: 'Saavedra' }, { codigo: '09117', descripcion: 'Teodoro Schmidt' }, { codigo: '09118', descripcion: 'Toltén' }, { codigo: '09119', descripcion: 'Vilcún' }, { codigo: '09120', descripcion: 'Villarrica' }, { codigo: '09121', descripcion: 'Cholchol' }] },
    { codigo: '092', descripcion: 'Malleco', comunas: [{ codigo: '09201', descripcion: 'Angol' }, { codigo: '09202', descripcion: 'Collipulli' }, { codigo: '09203', descripcion: 'Curacautín' }, { codigo: '09204', descripcion: 'Ercilla' }, { codigo: '09205', descripcion: 'Lonquimay' }, { codigo: '09206', descripcion: 'Los Sauces' }, { codigo: '09207', descripcion: 'Lumaco' }, { codigo: '09208', descripcion: 'Purén' }, { codigo: '09209', descripcion: 'Renaico' }, { codigo: '09210', descripcion: 'Traiguén' }, { codigo: '09211', descripcion: 'Victoria' }] },
  ] },
  { codigo: 'X', descripcion: 'Los Lagos', provincias: [
    { codigo: '101', descripcion: 'Llanquihue', comunas: [{ codigo: '10101', descripcion: 'Puerto Montt' }, { codigo: '10102', descripcion: 'Calbuco' }, { codigo: '10103', descripcion: 'Cochamó' }, { codigo: '10104', descripcion: 'Fresia' }, { codigo: '10105', descripcion: 'Frutillar' }, { codigo: '10106', descripcion: 'Los Muermos' }, { codigo: '10107', descripcion: 'Llanquihue' }, { codigo: '10108', descripcion: 'Maullín' }, { codigo: '10109', descripcion: 'Puerto Varas' }] },
    { codigo: '102', descripcion: 'Chiloé', comunas: [{ codigo: '10201', descripcion: 'Castro' }, { codigo: '10202', descripcion: 'Ancud' }, { codigo: '10203', descripcion: 'Chonchi' }, { codigo: '10204', descripcion: 'Curaco de Vélez' }, { codigo: '10205', descripcion: 'Dalcahue' }, { codigo: '10206', descripcion: 'Puqueldón' }, { codigo: '10207', descripcion: 'Queilén' }, { codigo: '10208', descripcion: 'Quellón' }, { codigo: '10209', descripcion: 'Quemchi' }, { codigo: '10210', descripcion: 'Quinchao' }] },
    { codigo: '103', descripcion: 'Osorno', comunas: [{ codigo: '10301', descripcion: 'Osorno' }, { codigo: '10302', descripcion: 'Puerto Octay' }, { codigo: '10303', descripcion: 'Purranque' }, { codigo: '10304', descripcion: 'Puyehue' }, { codigo: '10305', descripcion: 'Río Negro' }, { codigo: '10306', descripcion: 'San Juan de la Costa' }, { codigo: '10307', descripcion: 'San Pablo' }] },
    { codigo: '104', descripcion: 'Palena', comunas: [{ codigo: '10401', descripcion: 'Chaitén' }, { codigo: '10402', descripcion: 'Futaleufú' }, { codigo: '10403', descripcion: 'Hualaihué' }, { codigo: '10404', descripcion: 'Palena' }] },
  ] },
  { codigo: 'XI', descripcion: 'Aysén del General Carlos Ibáñez del Campo', provincias: [
    { codigo: '111', descripcion: 'Coihaique', comunas: [{ codigo: '11101', descripcion: 'Coihaique' }, { codigo: '11102', descripcion: 'Lago Verde' }] },
    { codigo: '112', descripcion: 'Aisén', comunas: [{ codigo: '11201', descripcion: 'Aisén' }, { codigo: '11202', descripcion: 'Cisnes' }, { codigo: '11203', descripcion: 'Guaitecas' }] },
    { codigo: '113', descripcion: 'Capitán Prat', comunas: [{ codigo: '11301', descripcion: 'Cochrane' }, { codigo: '11302', descripcion: 'O\'Higgins' }, { codigo: '11303', descripcion: 'Tortel' }] },
    { codigo: '114', descripcion: 'General Carrera', comunas: [{ codigo: '11401', descripcion: 'Chile Chico' }, { codigo: '11402', descripcion: 'Río Ibáñez' }] },
  ] },
  { codigo: 'XII', descripcion: 'Magallanes y de la Antártica Chilena', provincias: [
    { codigo: '121', descripcion: 'Magallanes', comunas: [{ codigo: '12101', descripcion: 'Punta Arenas' }, { codigo: '12102', descripcion: 'Laguna Blanca' }, { codigo: '12103', descripcion: 'Río Verde' }, { codigo: '12104', descripcion: 'San Gregorio' }] },
    { codigo: '122', descripcion: 'Antártica Chilena', comunas: [{ codigo: '12201', descripcion: 'Cabo de Hornos' }, { codigo: '12202', descripcion: 'Antártica' }] },
    { codigo: '123', descripcion: 'Tierra del Fuego', comunas: [{ codigo: '12301', descripcion: 'Porvenir' }, { codigo: '12302', descripcion: 'Primavera' }, { codigo: '12303', descripcion: 'Timaukel' }] },
    { codigo: '124', descripcion: 'Última Esperanza', comunas: [{ codigo: '12401', descripcion: 'Natales' }, { codigo: '12402', descripcion: 'Torres del Paine' }] },
  ] },
  { codigo: 'RM', descripcion: 'Metropolitana de Santiago', provincias: [
    { codigo: '131', descripcion: 'Santiago', comunas: [{ codigo: '13101', descripcion: 'Santiago' }, { codigo: '13102', descripcion: 'Cerrillos' }, { codigo: '13103', descripcion: 'Cerro Navia' }, { codigo: '13104', descripcion: 'Conchalí' }, { codigo: '13105', descripcion: 'El Bosque' }, { codigo: '13106', descripcion: 'Estación Central' }, { codigo: '13107', descripcion: 'Huechuraba' }, { codigo: '13108', descripcion: 'Independencia' }, { codigo: '13109', descripcion: 'La Cisterna' }, { codigo: '13110', descripcion: 'La Florida' }, { codigo: '13111', descripcion: 'La Granja' }, { codigo: '13112', descripcion: 'La Pintana' }, { codigo: '13113', descripcion: 'La Reina' }, { codigo: '13114', descripcion: 'Las Condes' }, { codigo: '13115', descripcion: 'Lo Barnechea' }, { codigo: '13116', descripcion: 'Lo Espejo' }, { codigo: '13117', descripcion: 'Lo Prado' }, { codigo: '13118', descripcion: 'Macul' }, { codigo: '13119', descripcion: 'Maipú' }, { codigo: '13120', descripcion: 'Ñuñoa' }, { codigo: '13121', descripcion: 'Pedro Aguirre Cerda' }, { codigo: '13122', descripcion: 'Peñalolén' }, { codigo: '13123', descripcion: 'Providencia' }, { codigo: '13124', descripcion: 'Pudahuel' }, { codigo: '13125', descripcion: 'Quilicura' }, { codigo: '13126', descripcion: 'Quinta Normal' }, { codigo: '13127', descripcion: 'Recoleta' }, { codigo: '13128', descripcion: 'Renca' }, { codigo: '13129', descripcion: 'San Joaquín' }, { codigo: '13130', descripcion: 'San Miguel' }, { codigo: '13131', descripcion: 'San Ramón' }, { codigo: '13132', descripcion: 'Vitacura' }] },
    { codigo: '132', descripcion: 'Cordillera', comunas: [{ codigo: '13201', descripcion: 'Puente Alto' }, { codigo: '13202', descripcion: 'Pirque' }, { codigo: '13203', descripcion: 'San José de Maipo' }] },
    { codigo: '133', descripcion: 'Chacabuco', comunas: [{ codigo: '13301', descripcion: 'Colina' }, { codigo: '13302', descripcion: 'Lampa' }, { codigo: '13303', descripcion: 'Tiltil' }] },
    { codigo: '134', descripcion: 'Maipo', comunas: [{ codigo: '13401', descripcion: 'San Bernardo' }, { codigo: '13402', descripcion: 'Buin' }, { codigo: '13403', descripcion: 'Calera de Tango' }, { codigo: '13404', descripcion: 'Paine' }] },
    { codigo: '135', descripcion: 'Melipilla', comunas: [{ codigo: '13501', descripcion: 'Melipilla' }, { codigo: '13502', descripcion: 'Alhué' }, { codigo: '13503', descripcion: 'Curacaví' }, { codigo: '13504', descripcion: 'María Pinto' }, { codigo: '13505', descripcion: 'San Pedro' }] },
    { codigo: '136', descripcion: 'Talagante', comunas: [{ codigo: '13601', descripcion: 'Talagante' }, { codigo: '13602', descripcion: 'El Monte' }, { codigo: '13603', descripcion: 'Isla de Maipo' }, { codigo: '13604', descripcion: 'Padre Hurtado' }, { codigo: '13605', descripcion: 'Peñaflor' }] },
  ] },
  { codigo: 'XIV', descripcion: 'Los Ríos', provincias: [
    { codigo: '141', descripcion: 'Valdivia', comunas: [{ codigo: '14101', descripcion: 'Valdivia' }, { codigo: '14102', descripcion: 'Corral' }, { codigo: '14103', descripcion: 'Lanco' }, { codigo: '14104', descripcion: 'Los Lagos' }, { codigo: '14105', descripcion: 'Máfil' }, { codigo: '14106', descripcion: 'Mariquina' }, { codigo: '14107', descripcion: 'Paillaco' }, { codigo: '14108', descripcion: 'Panguipulli' }] },
    { codigo: '142', descripcion: 'Ranco', comunas: [{ codigo: '14201', descripcion: 'La Unión' }, { codigo: '14202', descripcion: 'Futrono' }, { codigo: '14203', descripcion: 'Lago Ranco' }, { codigo: '14204', descripcion: 'Río Bueno' }] },
  ] },
  { codigo: 'XV', descripcion: 'Arica y Parinacota', provincias: [
    { codigo: '151', descripcion: 'Arica', comunas: [{ codigo: '15101', descripcion: 'Arica' }, { codigo: '15102', descripcion: 'Camarones' }] },
    { codigo: '152', descripcion: 'Parinacota', comunas: [{ codigo: '15201', descripcion: 'Putre' }, { codigo: '15202', descripcion: 'General Lagos' }] },
  ] },
  { codigo: 'XVI', descripcion: 'Ñuble', provincias: [
    { codigo: '161', descripcion: 'Diguillín', comunas: [{ codigo: '16101', descripcion: 'Chillán' }, { codigo: '16102', descripcion: 'Bulnes' }, { codigo: '16103', descripcion: 'Chillán Viejo' }, { codigo: '16104', descripcion: 'El Carmen' }, { codigo: '16105', descripcion: 'Pemuco' }, { codigo: '16106', descripcion: 'Pinto' }, { codigo: '16107', descripcion: 'Quillón' }, { codigo: '16108', descripcion: 'San Ignacio' }, { codigo: '16109', descripcion: 'Yungay' }] },
    { codigo: '162', descripcion: 'Itata', comunas: [{ codigo: '16201', descripcion: 'Quirihue' }, { codigo: '16202', descripcion: 'Cobquecura' }, { codigo: '16203', descripcion: 'Coelemu' }, { codigo: '16204', descripcion: 'Ninhue' }, { codigo: '16205', descripcion: 'Portezuelo' }, { codigo: '16206', descripcion: 'Ránquil' }, { codigo: '16207', descripcion: 'Treguaco' }] },
    { codigo: '163', descripcion: 'Punilla', comunas: [{ codigo: '16301', descripcion: 'San Carlos' }, { codigo: '16302', descripcion: 'Coihueco' }, { codigo: '16303', descripcion: 'Ñiquén' }, { codigo: '16304', descripcion: 'San Fabián' }, { codigo: '16305', descripcion: 'San Nicolás' }] },
  ] },
]
