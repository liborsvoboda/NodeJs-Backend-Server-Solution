module.exports = (sequelize, type) => {
  return sequelize.define('heurekaapikeys', {
    id: {
      type: type.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    uuid: {
      type: type.UUID,
      allowNull: false
    },
    Name: {
      type: type.STRING(255),
      allowNull: false
    },
    heurekaAPIkey: {
      type: type.STRING(32),
      allowNull: false
    },
    country: {
      type: type.STRING(10),
      allowNull: false
    },
    isvalid: {
      type: type.BOOLEAN,
      allowNull: true
    },
    lastCheck: {
      type: type.DATE,
      allowNull: true
    },
    lastScore: {
        type: type.DECIMAL(2, 1),
        allowNull: false,
        defaultValue: 0
    }
  }, {
    indexes: [
      {
        unique: true,
        name: 'IX_heurekaAPIkey',
        fields: ['uuid', 'heurekaAPIkey', 'country']
      }
    ],
    freezeTableName: true,
    timestamps: false
  });
};
