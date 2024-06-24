export function getUrlParams(url) {
    const paramRegex = /[?&]([^=#]+)=([^&#]*)/g;
    const params = {};
    let match;

    while ((match = paramRegex.exec(url))) {
        const paramName = decodeURIComponent(match[1]);
        const paramValue = decodeURIComponent(match[2]);
        params[paramName] = paramValue;
    }

    return params;
}

export function checkEmailCanRegister(email) {
    const blackMailDomain = [
        'yopmail.net',
        'chacuo.net',
        '027168.com',
        'teml.net',
        'tmpeml.com',
        'tmpbox.net',
        'moakt.cc',
        'disbox.net',
        'tmpmail.org',
        'tmpmail.net',
        'tmails.net',
        'disbox.org',
        'moakt.co',
        'moakt.ws',
        'tmail.wsbareed.ws',
        'mailto.plus',
        'fexpost.com',
        'fexbox.org',
        'mailbox.in.ua',
        'rover.info',
        'chitthi.in',
        'fextemp.com',
        'any.pink',
        'merepost.com',
        'mail.seaoss.com',
        'exeneli.com',
        'qiip.cc',
        'mail.qiip.cc',
        'smdy.one',
        'mail.smdy.one',
        'soraplus.cc',
        'mail.soraplus.cc',
        'inddweg.com',
        'linshiyouxiang.net',
        'besttempmail.com',
        'gongjua.com',
        'celebrityfull.com',
        'comparisions.net',
        'mediaholy.com',
        'maillazy.com',
        'justdefinition.com',
        'inctart.com',
        'deepyinc.com',
        'floodouts.com',
        'rfcdrive.com',
        'sharklasers.com',
        'guerrillamail.info',
        'grr.la',
        'guerrillamail.biz',
        'guerrillamail.com',
        'guerrillamail.de',
        'guerrillamail.net',
        'guerrillamail.org',
        'guerrillamailblock.com',
        'pokemail.net',
        'spam4.me',
        'nqmo.com',
        'qabq.com',
        'end.tw',
        'uuf.me',
        'yzm.de',
        'navalcadets.com',
        'mynanaimohomes.com',
        'muatoc.com',
        'miteon.com',
        'nespressopixie.com',
        'maxamba.com',
        'mailadresi.tk',
        'sind-hier.com',
        'miistermail.fr',
        'toolbox.ovh',
        'nori24.tv',
        'korekgas.info',
        'ist-hier.com',
        '1xp.fr',
        'cpc.cx',
        '0cd.cn',
        'prc.cx',
        'b7s.ru',
        'ab34.fr',
        'e3b.org',
        'new.ovh',
        'ves.ink',
        'q0.us.to',
        'zx81.ovh',
        'wishy.fr',
        'bmn.ch.ma',
        'iya.fr.nf',
        'sdj.fr.nf',
        'afw.fr.nf',
        'mail34.fr',
        'mynes.com',
        'dao.pp.ua',
        'nori24.tv',
        'lerch.ovh',
        'breizh.im',
        'six25.biz',
        'art.fr.cr',
        'red.fr.cr',
        'ywzmb.top',
        'nyndt.top',
        'isep.fr.nf',
        'noreply.fr',
        'pliz.fr.nf',
        'noyp.fr.nf',
        'zouz.fr.nf',
        'hunnur.com',
        'wxcv.fr.nf',
        'zorg.fr.nf',
        'imap.fr.nf',
        'redi.fr.nf',
        'dlvr.us.to',
        'y.iotf.net',
        'zinc.fr.nf',
        'ym.cypi.fr',
        'yop.too.li',
        'dmts.fr.nf',
        'binich.com',
        'wzofit.com',
        'jmail.fr.nf',
        'zimel.fr.cr',
        'yaloo.fr.nf',
        'jinva.fr.nf',
        'ag.prout.be',
        'ba.prout.be',
        'es.prout.be',
        'us.prout.be',
        'ealea.fr.nf',
        'nomes.fr.nf',
        'yop.kd2.org',
        'alves.fr.nf',
        'bibi.biz.st',
        'ymail.rr.nu',
        'bboys.fr.nf',
        'ma.ezua.com',
        'ma.zyns.com',
        'mai.25u.com',
        'nomes.fr.cr',
        'autre.fr.nf',
        'lsyx0.rr.nu',
        'tweet.fr.nf',
        'pamil.1s.fr',
        'pamil.fr.nf',
        'ymail.1s.fr',
        '15963.fr.nf',
        'popol.fr.nf',
        'pmail.1s.fr',
        'flobo.fr.nf',
        'toolbox.ovh',
        'bin-ich.com',
        'sindwir.com',
        'mabal.fr.nf',
        'degap.fr.nf',
        'yop.uuii.in',
        'jetable.org',
        'a.kwtest.io',
        'pasdus.fr.cr',
        'gland.xxl.st',
        'nospam.fr.nf',
        'azeqsd.fr.nf',
        'le.monchu.fr',
        'nikora.fr.nf',
        'sendos.fr.nf',
        'mai.dhcp.biz',
        'cubox.biz.st',
        'fhpfhp.fr.nf',
        'c-eric.fr.nf',
        'c-eric.fr.cr',
        'bahoo.biz.st',
        'upc.infos.st',
        'gggggg.fr.cr',
        'spam.aleh.de',
        'alphax.fr.nf',
        'habenwir.com',
        'ist-hier.com',
        'sind-wir.com',
        'sindhier.com',
        'wir-sind.com',
        'myself.fr.nf',
        'yop.mabox.eu',
        'vip.ep77.com',
        'email.jjj.ee',
        'druzik.pp.ua',
        'yahooz.xxl.st',
        'tiscali.fr.cr',
        'altrans.fr.nf',
        'yoptruc.fr.nf',
        'kyuusei.fr.nf',
        'ac-cool.c4.fr',
        'certexx.fr.nf',
        'dede.infos.st',
        'sake.prout.be',
        'eureka.0rg.fr',
        'yotmail.fr.nf',
        'miloras.fr.nf',
        'nikora.biz.st',
        'cabiste.fr.nf',
        'galaxim.fr.nf',
        'fuppurge.info',
        'doviaso.fr.cr',
        'pitiful.pp.ua',
        'ggmail.biz.st',
        'dis.hopto.org',
        'yop.kyriog.fr',
        '1.8259law.com',
        'icidroit.info',
        'yop.mc-fly.be',
        'spam.9001.ovh',
        'tmp.x-lab.net',
        'mail.hsmw.net',
        'y.dldweb.info',
        'haben-wir.com',
        'sind-hier.com',
        'adresse.fr.cr',
        'temp.ig96.net',
        'assurmail.net',
        'yop.smeux.com',
        'korekgas.info',
        'alyxgod.rf.gd',
        'mailadresi.tk',
        'vip.222.ac.cn',
        'aze.kwtest.io',
        'mailbox.biz.st',
        'elmail.4pu.com',
        'carioca.biz.st',
        'mickaben.fr.nf',
        'mickaben.fr.cr',
        'ac-malin.fr.nf',
        'gimuemoa.fr.nf',
        'woofidog.fr.nf',
        'rygel.infos.st',
        'cheznico.fr.cr',
        'contact.biz.st',
        'rapidefr.fr.nf',
        'calendro.fr.nf',
        'calima.asso.st',
        'cobal.infos.st',
        'terre.infos.st',
        'imails.asso.st',
        'warlus.asso.st',
        'carnesa.biz.st',
        'jackymel.xl.cx',
        'mail.tbr.fr.nf',
        'webstore.fr.nf',
        'freemail.fr.cr',
        'mr-email.fr.nf',
        'abo-free.fr.nf',
        'courrier.fr.cr',
        'ymail.ploki.fr',
        'mailsafe.fr.nf',
        'mail.jab.fr.cr',
        'testkkk.zik.dj',
        'sirttest.us.to',
        'yop.moolee.net',
        'antispam.fr.nf',
        'machen-wir.com',
        'adresse.biz.st',
        'poubelle.fr.nf',
        'lacraffe.fr.nf',
        'gladogmi.fr.nf',
        'yopmail.ozm.fr',
        'mail.yabes.ovh',
        'totococo.fr.nf',
        'miistermail.fr',
        'yopmail.kro.kr',
        'freemail.biz.st',
        'skynet.infos.st',
        'readmail.biz.st',
        'frostmail.fr.nf',
        'frostmail.fr.cr',
        'pitimail.xxl.st',
        'mickaben.biz.st',
        'mickaben.xxl.st',
        'internaut.us.to',
        'askold.prout.be',
        'poubelle-du.net',
        'mondial.asso.st',
        'randol.infos.st',
        'himail.infos.st',
        'sendos.infos.st',
        'nidokela.biz.st',
        'likeageek.fr.nf',
        'mcdomaine.fr.nf',
        'emaildark.fr.nf',
        'mymail.ns01.biz',
        'cookie007.fr.nf',
        'tagara.infos.st',
        'pokemons1.fr.nf',
        'spam.quillet.eu',
        'desfrenes.fr.nf',
        'mymail.infos.st',
        'mail.i-dork.com',
        'mail.berwie.com',
        'mesemails.fr.nf',
        'dripzgaming.com',
        'mymaildo.kro.kr',
        'dann.mywire.org',
        'mymailbox.xxl.st',
        'mail.xstyled.net',
        'dreamgreen.fr.nf',
        'contact.infos.st',
        'mess-mails.fr.nf',
        'omicron.token.ro',
        'torrent411.fr.nf',
        'yop.tv-sante.com',
        'test.inclick.net',
        'ssi-bsn.infos.st',
        'webclub.infos.st',
        'addedbyjc.0rg.fr',
        'vigilantkeep.net',
        'actarus.infos.st',
        'whatagarbage.com',
        'yopmail.ploki.fr',
        'test-infos.fr.nf',
        'mail-mario.fr.nf',
        'www3.freetcp.com',
        'dispo.sebbcn.net',
        'ym.digi-value.fr',
        'adresse.infos.st',
        'ypmail.sehier.fr',
        'pixelgagnant.net',
        'saruawaeah.co.uk',
        'm.tartinemoi.com',
        'suck.my-vigor.de',
        'ggamess.42web.io',
        'cool.fr.nf',
        'courriel.fr.nf',
        'jetable.fr.nf',
        'mega.zik.dj',
        'moncourrier.fr.nf',
        'monemail.fr.nf',
        'monmail.fr.nf',
        'nomail.xl.cx',
        'nospam.ze.tc',
        'speed.1s.fr',
        'yopmail.com',
        'yopmail.fr',
        'yopmail.net',
        'maildrop.cc',
        'dalebig.com',
        'mailna.co',
        'mozej.com',
        'mailna.in',
        'mailna.me',
        'mohmal.im',
        'mohmal.in',
        'altmails.com',
        'ilebi.com',
        'doolk.com',
        'vogco.com',
        'mymailprotection.xyz',
        'playxo.com',
        '1secmail.com',
        '@1secmail.org',
        '@1secmail.net',
        'vjuum.com',
        'laafd.com',
        'txcct.com',
        'rteet.com',
        'dpptd.com'
    ]
    const item = blackMailDomain.find((item) => {
        const regex = new RegExp(item)
        return regex.test(email)
    })
    if (item) {
        return false
    } else {
        return true
    }
}
